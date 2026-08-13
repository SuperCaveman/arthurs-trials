# The worker's local file outbox models the same at-least-once delivery shape.
# Managed SQS uses an AWS-owned encryption key and an explicit DLQ so a poison
# result cannot block normal reward processing indefinitely.
resource "aws_sqs_queue" "dead_letter" {
  name                      = "${var.name_prefix}-match-results-dlq"
  message_retention_seconds = 1209600 # 14 days: enough for operator recovery, not indefinite player-data retention.
  sqs_managed_sse_enabled   = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-match-results-dlq"
    role = "dead-letter"
  })
}

resource "aws_sqs_queue" "match_results" {
  name                       = "${var.name_prefix}-match-results"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 days
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = 5
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-match-results"
    role = "authoritative-results"
  })
}
