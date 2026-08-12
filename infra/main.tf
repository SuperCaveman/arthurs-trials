locals {
  managed_demo_requested = var.deployment_mode == "demo"
  managed_demo_enabled   = local.managed_demo_requested && var.allow_managed_demo

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
  count = local.managed_demo_requested ? 1 : 0

  input = {
    region     = var.aws_region
    expires_at = var.expires_at
  }

  lifecycle {
    precondition {
      condition     = var.allow_managed_demo
      error_message = "Managed demo is blocked. Set allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = can(timeadd(var.expires_at, "0s"))
      error_message = "A valid UTC expires_at timestamp is required for a managed demo."
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
