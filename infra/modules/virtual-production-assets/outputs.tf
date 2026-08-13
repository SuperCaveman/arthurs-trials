output "asset_bucket_name" {
  description = "Name of the private, versioned virtual-production asset bucket."
  value       = aws_s3_bucket.asset_versions.bucket
}

output "asset_bucket_arn" {
  description = "ARN of the private, versioned virtual-production asset bucket."
  value       = aws_s3_bucket.asset_versions.arn
}

output "approval_table_name" {
  description = "Name of the on-demand stage-approval metadata table."
  value       = aws_dynamodb_table.stage_approvals.name
}

output "approval_table_arn" {
  description = "ARN of the on-demand stage-approval metadata table."
  value       = aws_dynamodb_table.stage_approvals.arn
}
