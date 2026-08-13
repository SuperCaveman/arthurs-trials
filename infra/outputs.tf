output "managed_demo_enabled" {
  description = "Whether this configuration is allowed to create managed-demo AWS resources."
  value       = local.managed_demo_enabled
}

output "planned_resource_boundary" {
  description = "What this initial IaC slice can create when explicitly enabled."
  value = concat(
    local.managed_demo_enabled ? [
      "two-AZ VPC",
      "public and private subnets",
      "internet gateway and public routing",
      "no NAT gateway by default",
    ] : [],
    local.identity_enabled ? ["Cognito user pool and public Unreal app client"] : [],
    local.github_oidc_enabled ? ["permissionless GitHub Actions OIDC trust role"] : [],
    local.async_results_enabled ? ["SQS match-results queue and dead-letter queue"] : [],
    local.database_enabled ? ["private encrypted PostgreSQL RDS instance"] : [],
    local.results_worker_enabled ? ["private ECS/Fargate results-worker service at desired count zero"] : [],
    local.observability_enabled ? ["CloudWatch worker dashboard and five alarms"] : [],
    local.virtual_production_assets_enabled ? ["versioned private S3 virtual-production asset bucket and on-demand approval metadata table"] : [],
  )
}

output "operations_dashboard_name" {
  description = "Optional CloudWatch operations dashboard name; null in local mode."
  value       = local.observability_enabled ? module.observability[0].dashboard_name : null
}

output "results_worker_service_name" {
  description = "Optional ECS results-worker service name; null in local mode."
  value       = local.results_worker_enabled ? module.results_worker_runtime[0].service_name : null
}

output "vpc_id" {
  description = "Optional demo VPC ID; null in local mode."
  value       = local.managed_demo_enabled ? module.network[0].vpc_id : null
}

output "cognito_user_pool_id" {
  description = "Optional Cognito user pool ID; null in local mode."
  value       = local.identity_enabled ? module.identity[0].user_pool_id : null
}

output "github_actions_oidc_role_arn" {
  description = "Optional permissionless GitHub OIDC trust role; null in local mode."
  value       = local.github_oidc_enabled ? module.github_oidc[0].role_arn : null
}

output "match_results_queue_arn" {
  description = "Optional SQS match-results queue ARN; null in local mode."
  value       = local.async_results_enabled ? module.async_results[0].queue_arn : null
}

output "match_results_dead_letter_queue_arn" {
  description = "Optional SQS match-results DLQ ARN; null in local mode."
  value       = local.async_results_enabled ? module.async_results[0].dead_letter_queue_arn : null
}

output "postgres_endpoint" {
  description = "Optional private PostgreSQL endpoint; null in local mode."
  value       = local.database_enabled ? module.database[0].endpoint : null
}

output "postgres_master_user_secret_arn" {
  description = "Optional RDS-managed secret ARN; null in local mode."
  value       = local.database_enabled ? module.database[0].master_user_secret_arn : null
}

output "virtual_production_asset_bucket_name" {
  description = "Optional private versioned asset bucket name; null in local mode."
  value       = local.virtual_production_assets_enabled ? module.virtual_production_assets[0].asset_bucket_name : null
}

output "virtual_production_approval_table_name" {
  description = "Optional stage-approval metadata table name; null in local mode."
  value       = local.virtual_production_assets_enabled ? module.virtual_production_assets[0].approval_table_name : null
}

output "virtual_production_stage_read_role_arn" {
  description = "Optional least-privilege role the local stage would assume to retrieve approved assets; null in local mode."
  value       = local.virtual_production_assets_enabled ? module.virtual_production_assets[0].stage_read_role_arn : null
}
