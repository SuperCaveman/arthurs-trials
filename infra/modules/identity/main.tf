# This module intentionally creates a public Cognito app client: the Unreal
# client must never hold an app secret or AWS credentials. The API validates
# its user-pool JWT and remains the only caller of GameLift control-plane APIs.
resource "aws_cognito_user_pool" "players" {
  name                     = "${var.name_prefix}-players"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  software_token_mfa_configuration {
    enabled = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "unreal" {
  name         = "${var.name_prefix}-unreal-client"
  user_pool_id = aws_cognito_user_pool.players.id

  # Unreal is a distributed client, so this client has no secret. Token
  # validation belongs to the private session API, not to the game binary.
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  allowed_oauth_flows_user_pool_client = false
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]
}
