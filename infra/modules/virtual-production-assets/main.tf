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
