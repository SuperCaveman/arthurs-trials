output "role_arn" {
  description = "Permissionless GitHub Actions OIDC trust-role ARN."
  value       = aws_iam_role.github_actions_trust.arn
}
