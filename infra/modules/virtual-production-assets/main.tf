# The asset bucket is private, versioned, and encrypted with the AWS-managed
# S3 key. A randomly suffixed bucket name avoids global-name collisions while
# keeping the module reusable across productions. No objects are uploaded by
# Terraform; the future artist-publish service owns that action.
resource "aws_s3_bucket" "asset_versions" {
  bucket_prefix = "${var.name_prefix}-vp-assets-"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-assets"
    role = "virtual-production-versioned-assets"
  })
}

resource "aws_s3_bucket_public_access_block" "asset_versions" {
  bucket                  = aws_s3_bucket.asset_versions.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "asset_versions" {
  bucket = aws_s3_bucket.asset_versions.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "asset_versions" {
  bucket = aws_s3_bucket.asset_versions.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Noncurrent source versions stay recoverable before transitioning to a lower
# cost archive class. They are intentionally not expired by this template.
resource "aws_s3_bucket_lifecycle_configuration" "asset_versions" {
  bucket = aws_s3_bucket.asset_versions.id

  rule {
    id     = "archive-noncurrent-production-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER_IR"
    }
  }
}

# S3 publishes object-created events to the default EventBridge bus. The rule
# below accepts only incoming artist uploads, keeping deployment/recovery
# object transitions out of the validation entry point.
resource "aws_s3_bucket_notification" "asset_versions" {
  bucket      = aws_s3_bucket.asset_versions.id
  eventbridge = true
}

# A simple on-demand metadata record makes approval and stage deployment state
# auditable without running a database. Workflows use assetVersionId + target
# as the immutable approval key; payload metadata stays application-owned.
resource "aws_dynamodb_table" "stage_approvals" {
  name         = "${var.name_prefix}-vp-stage-approvals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "assetVersionId"
  range_key    = "stageTarget"

  attribute {
    name = "assetVersionId"
    type = "S"
  }

  attribute {
    name = "stageTarget"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-stage-approvals"
    role = "virtual-production-stage-approval-metadata"
  })
}

# The local stage never receives write access. An organization-specific
# workstation/federated identity must be named explicitly by the root module
# before this role can be created.
data "aws_iam_policy_document" "stage_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = [var.stage_trusted_principal_arn]
    }
  }
}

data "aws_iam_policy_document" "stage_asset_read" {
  statement {
    sid       = "ListOnlyThisProductionAssetBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.asset_versions.arn]
  }

  statement {
    sid    = "ReadVersionedApprovedAssetObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectTagging",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionTagging",
    ]
    resources = ["${aws_s3_bucket.asset_versions.arn}/approved/*"]
  }

  statement {
    sid       = "ReadApprovalForAssignedStage"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources = [aws_dynamodb_table.stage_approvals.arn]
  }
}

resource "aws_iam_role" "stage_asset_read" {
  name               = "${var.name_prefix}-vp-stage-read"
  assume_role_policy = data.aws_iam_policy_document.stage_assume_role.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-stage-read"
    role = "virtual-production-stage-asset-read"
  })
}

resource "aws_iam_role_policy" "stage_asset_read" {
  name   = "${var.name_prefix}-vp-stage-approved-asset-read"
  role   = aws_iam_role.stage_asset_read.id
  policy = data.aws_iam_policy_document.stage_asset_read.json
}

# This serverless intake workflow verifies that the object which raised the S3
# event still exists and records an explicit validation-requested event. It is
# deliberately limited to structural intake validation; Unreal cooking/package
# validation remains a future build job, not an unsafe claim made by this IaC.
resource "aws_cloudwatch_log_group" "asset_validation" {
  name              = "/arthurs-trials/virtual-production/asset-validation"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-asset-validation"
    role = "virtual-production-validation-observability"
  })
}

data "aws_iam_policy_document" "validation_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "validation_workflow" {
  statement {
    sid       = "ReadIncomingObjectMetadata"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.asset_versions.arn}/incoming/*"]
  }

  statement {
    sid    = "WriteWorkflowLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role" "validation_workflow" {
  name               = "${var.name_prefix}-vp-validation-workflow"
  assume_role_policy = data.aws_iam_policy_document.validation_assume_role.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-validation-workflow"
    role = "virtual-production-asset-validation"
  })
}

resource "aws_iam_role_policy" "validation_workflow" {
  name   = "${var.name_prefix}-vp-validation-workflow"
  role   = aws_iam_role.validation_workflow.id
  policy = data.aws_iam_policy_document.validation_workflow.json
}

resource "aws_sfn_state_machine" "asset_validation" {
  name     = "${var.name_prefix}-vp-asset-validation"
  role_arn = aws_iam_role.validation_workflow.arn
  type     = "STANDARD"

  definition = jsonencode({
    Comment = "Structural intake validation for an Unreal virtual-production asset upload."
    StartAt = "CheckUploadedObject"
    States = {
      CheckUploadedObject = {
        Type     = "Task"
        Resource = "arn:aws:states:::aws-sdk:s3:headObject"
        Parameters = {
          "Bucket.$" = "$.detail.bucket.name"
          "Key.$"    = "$.detail.object.key"
        }
        Next = "RecordValidationRequested"
      }
      RecordValidationRequested = {
        Type = "Pass"
        Result = {
          status = "Processing"
          note   = "Object exists; future Unreal package validator is ready to consume this request."
        }
        End = true
      }
    }
  })

  logging_configuration {
    include_execution_data = false
    level                  = "ERROR"
    log_destination        = "${aws_cloudwatch_log_group.asset_validation.arn}:*"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-asset-validation"
    role = "virtual-production-validation-state-machine"
  })
}

data "aws_iam_policy_document" "eventbridge_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "eventbridge_start_validation" {
  statement {
    effect    = "Allow"
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.asset_validation.arn]
  }
}

resource "aws_iam_role" "eventbridge_start_validation" {
  name               = "${var.name_prefix}-vp-eventbridge-start-validation"
  assume_role_policy = data.aws_iam_policy_document.eventbridge_assume_role.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-eventbridge-start-validation"
    role = "virtual-production-eventbridge-start"
  })
}

resource "aws_iam_role_policy" "eventbridge_start_validation" {
  name   = "${var.name_prefix}-vp-eventbridge-start-validation"
  role   = aws_iam_role.eventbridge_start_validation.id
  policy = data.aws_iam_policy_document.eventbridge_start_validation.json
}

resource "aws_cloudwatch_event_rule" "incoming_asset_upload" {
  name        = "${var.name_prefix}-vp-incoming-asset-upload"
  description = "Starts structural validation for new virtual-production artist uploads."
  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = { name = [aws_s3_bucket.asset_versions.id] }
      object = { key = [{ prefix = "incoming/" }] }
    }
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vp-incoming-asset-upload"
    role = "virtual-production-validation-trigger"
  })
}

resource "aws_cloudwatch_event_target" "incoming_asset_validation" {
  rule      = aws_cloudwatch_event_rule.incoming_asset_upload.name
  target_id = "asset-validation-workflow"
  arn       = aws_sfn_state_machine.asset_validation.arn
  role_arn  = aws_iam_role.eventbridge_start_validation.arn
}
