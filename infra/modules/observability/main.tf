data "aws_region" "current" {}

locals {
  dashboard_name = "${var.name_prefix}-operations"
  common_alarm = {
    alarm_actions             = var.alarm_actions
    actions_enabled           = length(var.alarm_actions) > 0
    treat_missing_data        = "notBreaching"
    insufficient_data_actions = []
    tags                      = var.tags
  }
}

# This compact dashboard stays within CloudWatch's native metrics: no managed
# Grafana, Prometheus, or custom high-cardinality telemetry is introduced.
resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = local.dashboard_name
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Authoritative results transport"
          region = data.aws_region.current.name
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", var.match_results_queue_name, { label = "Result queue age (seconds)" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.match_results_queue_name, { label = "Result queue visible" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.dead_letter_queue_name, { label = "DLQ visible" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Results-worker service"
          region = data.aws_region.current.name
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.cluster_name, "ServiceName", var.service_name],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.cluster_name, "ServiceName", var.service_name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          title  = "Private PostgreSQL"
          region = data.aws_region.current.name
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.database_identifier],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.database_identifier],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.database_identifier],
          ]
        }
      },
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "queue_age" {
  alarm_name                = "${var.name_prefix}-results-queue-age"
  alarm_description         = "Authoritative results are waiting more than two minutes."
  namespace                 = "AWS/SQS"
  metric_name               = "ApproximateAgeOfOldestMessage"
  statistic                 = "Maximum"
  period                    = 60
  evaluation_periods        = 2
  threshold                 = 120
  comparison_operator       = "GreaterThanThreshold"
  dimensions                = { QueueName = var.match_results_queue_name }
  alarm_actions             = local.common_alarm.alarm_actions
  actions_enabled           = local.common_alarm.actions_enabled
  treat_missing_data        = local.common_alarm.treat_missing_data
  insufficient_data_actions = local.common_alarm.insufficient_data_actions
  tags                      = local.common_alarm.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name                = "${var.name_prefix}-results-dlq-depth"
  alarm_description         = "At least one authoritative result requires operator recovery."
  namespace                 = "AWS/SQS"
  metric_name               = "ApproximateNumberOfMessagesVisible"
  statistic                 = "Maximum"
  period                    = 60
  evaluation_periods        = 1
  threshold                 = 0
  comparison_operator       = "GreaterThanThreshold"
  dimensions                = { QueueName = var.dead_letter_queue_name }
  alarm_actions             = local.common_alarm.alarm_actions
  actions_enabled           = local.common_alarm.actions_enabled
  treat_missing_data        = local.common_alarm.treat_missing_data
  insufficient_data_actions = local.common_alarm.insufficient_data_actions
  tags                      = local.common_alarm.tags
}

resource "aws_cloudwatch_metric_alarm" "worker_cpu" {
  alarm_name                = "${var.name_prefix}-results-worker-cpu"
  alarm_description         = "Results worker CPU is saturated."
  namespace                 = "AWS/ECS"
  metric_name               = "CPUUtilization"
  statistic                 = "Average"
  period                    = 60
  evaluation_periods        = 3
  threshold                 = 80
  comparison_operator       = "GreaterThanThreshold"
  dimensions                = { ClusterName = var.cluster_name, ServiceName = var.service_name }
  alarm_actions             = local.common_alarm.alarm_actions
  actions_enabled           = local.common_alarm.actions_enabled
  treat_missing_data        = local.common_alarm.treat_missing_data
  insufficient_data_actions = local.common_alarm.insufficient_data_actions
  tags                      = local.common_alarm.tags
}

resource "aws_cloudwatch_metric_alarm" "worker_memory" {
  alarm_name                = "${var.name_prefix}-results-worker-memory"
  alarm_description         = "Results worker memory is saturated."
  namespace                 = "AWS/ECS"
  metric_name               = "MemoryUtilization"
  statistic                 = "Average"
  period                    = 60
  evaluation_periods        = 3
  threshold                 = 85
  comparison_operator       = "GreaterThanThreshold"
  dimensions                = { ClusterName = var.cluster_name, ServiceName = var.service_name }
  alarm_actions             = local.common_alarm.alarm_actions
  actions_enabled           = local.common_alarm.actions_enabled
  treat_missing_data        = local.common_alarm.treat_missing_data
  insufficient_data_actions = local.common_alarm.insufficient_data_actions
  tags                      = local.common_alarm.tags
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name                = "${var.name_prefix}-postgres-free-storage"
  alarm_description         = "Private PostgreSQL has less than 5 GiB free storage."
  namespace                 = "AWS/RDS"
  metric_name               = "FreeStorageSpace"
  statistic                 = "Average"
  period                    = 300
  evaluation_periods        = 1
  threshold                 = 5368709120
  comparison_operator       = "LessThanThreshold"
  dimensions                = { DBInstanceIdentifier = var.database_identifier }
  alarm_actions             = local.common_alarm.alarm_actions
  actions_enabled           = local.common_alarm.actions_enabled
  treat_missing_data        = local.common_alarm.treat_missing_data
  insufficient_data_actions = local.common_alarm.insufficient_data_actions
  tags                      = local.common_alarm.tags
}
