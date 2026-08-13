resource "aws_cloudwatch_log_group" "worker" {
  name              = "/arthurs-trials/${var.name_prefix}/results-worker"
  retention_in_days = 14
  tags              = var.tags
}

# The generated RDS secret is fetched by the task at startup. It is not placed
# in task-definition environment variables, Terraform outputs, or source code.
data "aws_iam_policy_document" "read_database_secret" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.database_secret_arn]
  }
}

resource "aws_iam_role_policy" "read_database_secret" {
  name   = "read-results-database-secret"
  role   = var.task_role_name
  policy = data.aws_iam_policy_document.read_database_secret.json
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-results-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name      = "results-worker"
    image     = var.worker_image_uri
    essential = true
    environment = [
      { name = "AWS_REGION", value = "${data.aws_region.current.name}" },
      { name = "RESULTS_QUEUE_URL", value = var.match_results_queue_url },
      { name = "RESULTS_DATABASE_SECRET_ARN", value = var.database_secret_arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "worker"
      }
    }
  }])

  tags = var.tags
}

data "aws_region" "current" {}

# desired_count=0 is intentional: Terraform can model the running shape
# without starting Fargate compute. Raising it requires separate approval.
resource "aws_ecs_service" "worker" {
  name            = "${var.name_prefix}-results-worker"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  tags = var.tags
}
