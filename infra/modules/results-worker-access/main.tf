data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_ecs_cluster" "results" {
  name = "${var.name_prefix}-results"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-results"
    role = "results-worker"
  })
}

# The worker is not internet-facing. Its security group intentionally has no
# ingress. Egress remains available for a future explicit endpoints/NAT choice.
resource "aws_security_group" "worker" {
  name        = "${var.name_prefix}-results-worker"
  description = "No-ingress security group for the results worker task."
  vpc_id      = var.vpc_id

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
    description = "Required only after an approved private-egress path is selected."
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-results-worker"
    role = "results-worker"
  })
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-results-worker-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-results-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = var.tags
}

data "aws_iam_policy_document" "consume_results" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
    ]
    resources = [var.match_results_arn]
  }
}

resource "aws_iam_role_policy" "consume_results" {
  name   = "consume-authoritative-results"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.consume_results.json
}
