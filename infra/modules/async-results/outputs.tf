output "queue_arn" {
  description = "ARN of the authoritative match-results queue."
  value       = aws_sqs_queue.match_results.arn
}

output "queue_url" {
  description = "URL of the authoritative match-results queue."
  value       = aws_sqs_queue.match_results.url
}

output "dead_letter_queue_arn" {
  description = "ARN of the match-results dead-letter queue."
  value       = aws_sqs_queue.dead_letter.arn
}
