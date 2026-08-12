output "managed_demo_enabled" {
  description = "Whether this configuration is allowed to create managed-demo AWS resources."
  value       = local.managed_demo_enabled
}

output "planned_resource_boundary" {
  description = "What this initial IaC slice can create when explicitly enabled."
  value = local.managed_demo_enabled ? [
    "two-AZ VPC",
    "public and private subnets",
    "internet gateway and public routing",
    "no NAT gateway by default",
  ] : []
}

output "vpc_id" {
  description = "Optional demo VPC ID; null in local mode."
  value       = local.managed_demo_enabled ? module.network[0].vpc_id : null
}
