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
  )
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
