locals {
  managed_demo_requested = var.deployment_mode == "demo"
  managed_demo_enabled   = local.managed_demo_requested && var.allow_managed_demo
  identity_enabled       = local.managed_demo_enabled && var.enable_identity
  github_oidc_enabled    = local.managed_demo_enabled && var.enable_github_actions_oidc

  common_tags = {
    project        = "arthurs-trials"
    environment    = var.deployment_mode
    owner          = var.owner
    expires-at     = var.expires_at
    managed-demo   = tostring(local.managed_demo_enabled)
    provisioned-by = "terraform"
    cost-center    = "portfolio"
  }
}

provider "aws" {
  region = var.aws_region

  # The default local plan must not contact the AWS control plane. These checks
  # are re-enabled only when a managed demo is explicitly requested.
  skip_credentials_validation = !local.managed_demo_requested
  skip_requesting_account_id  = !local.managed_demo_requested
  skip_region_validation      = !local.managed_demo_requested
  skip_metadata_api_check     = true

  default_tags {
    tags = local.common_tags
  }
}

# This resource is only evaluated when a managed demo is requested. Its
# preconditions deliberately make "terraform plan -var deployment_mode=demo"
# fail unless the operator supplies a real expiration and explicit consent.
resource "terraform_data" "managed_demo_gate" {
  count = local.managed_demo_requested || var.enable_identity || var.enable_github_actions_oidc ? 1 : 0

  input = {
    region     = var.aws_region
    expires_at = var.expires_at
  }

  lifecycle {
    precondition {
      condition     = !local.managed_demo_requested || var.allow_managed_demo
      error_message = "Managed demo is blocked. Set allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !local.managed_demo_requested || can(timeadd(var.expires_at, "0s"))
      error_message = "A valid UTC expires_at timestamp is required for a managed demo."
    }

    precondition {
      condition     = !var.enable_identity || local.managed_demo_enabled
      error_message = "Identity is blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_github_actions_oidc || local.managed_demo_enabled
      error_message = "GitHub OIDC trust is blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_github_actions_oidc || trimspace(var.github_actions_oidc_provider_arn) != ""
      error_message = "github_actions_oidc_provider_arn is required when enable_github_actions_oidc=true."
    }
  }
}

# Default local mode has count = 0, so Terraform plans no AWS resources. The
# module is intentionally limited to the network foundation until a managed
# demo is explicitly approved.
module "network" {
  count  = local.managed_demo_enabled ? 1 : 0
  source = "./modules/network"

  name_prefix = "arthurs-trials-${var.deployment_mode}"
  vpc_cidr    = var.vpc_cidr
  tags        = local.common_tags
}

# Identity and delivery trust are separate optional slices. Both inherit the
# same explicit demo gate as the network, so the normal local plan stays empty.
module "identity" {
  count  = local.identity_enabled ? 1 : 0
  source = "./modules/identity"

  name_prefix = "arthurs-trials-${var.deployment_mode}"
  tags        = local.common_tags
}

module "github_oidc" {
  count  = local.github_oidc_enabled ? 1 : 0
  source = "./modules/github-oidc"

  name_prefix       = "arthurs-trials-${var.deployment_mode}"
  github_repository = var.github_repository
  oidc_provider_arn = var.github_actions_oidc_provider_arn
  tags              = local.common_tags
}
