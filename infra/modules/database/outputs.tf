output "security_group_id" {
  description = "Security group future application/worker tasks must be explicitly allowed into."
  value       = aws_security_group.postgres.id
}

output "endpoint" {
  description = "Private PostgreSQL endpoint; do not expose it to clients."
  value       = aws_db_instance.postgres.address
}

output "master_user_secret_arn" {
  description = "RDS-managed master credential secret ARN."
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}

output "instance_identifier" {
  description = "RDS instance identifier for CloudWatch metric dimensions."
  value       = aws_db_instance.postgres.identifier
}
