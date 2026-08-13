output "queue_arn" {
  description = "ARN of the authoritative match-results queue."
  value       = aws_sqs_queue.match_results.arn
}

output "queue_url" {
  description = "URL of the authoritative match-results queue."
  value       = aws_sqs_queue.match_results.url
}

output "queue_name" {
  description = "Name of the authoritative match-results queue for CloudWatch metric dimensions."
  value       = aws_sqs_queue.match_results.name
}

output "dead_letter_queue_arn" {
  description = "ARN of the match-results dead-letter queue."
  value       = aws_sqs_queue.dead_letter.arn
}

output "dead_letter_queue_name" {
  description = "Name of the DLQ for CloudWatch metric dimensions."
  value       = aws_sqs_queue.dead_letter.name
}
