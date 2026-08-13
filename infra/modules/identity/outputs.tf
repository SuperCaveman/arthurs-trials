output "user_pool_id" {
  description = "Cognito user pool ID for the managed demo."
  value       = aws_cognito_user_pool.players.id
}

output "user_pool_client_id" {
  description = "Public Unreal client ID; this is not an AWS credential."
  value       = aws_cognito_user_pool_client.unreal.id
}
