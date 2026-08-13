locals {
  managed_demo_requested            = var.deployment_mode == "demo"
  managed_demo_enabled              = local.managed_demo_requested && var.allow_managed_demo
  identity_enabled                  = local.managed_demo_enabled && var.enable_identity
  github_oidc_enabled               = local.managed_demo_enabled && var.enable_github_actions_oidc
  async_results_enabled             = local.managed_demo_enabled && var.enable_async_results
  database_enabled                  = local.managed_demo_enabled && var.enable_database
  results_worker_enabled            = local.managed_demo_enabled && var.enable_results_worker_runtime
  observability_enabled             = local.managed_demo_enabled && var.enable_observability
  virtual_production_assets_enabled = local.managed_demo_enabled && var.enable_virtual_production_assets

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
  count = local.managed_demo_requested || var.enable_identity || var.enable_github_actions_oidc || var.enable_async_results || var.enable_database || var.enable_results_worker_runtime || var.enable_observability || var.enable_virtual_production_assets ? 1 : 0

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
      condition     = !var.enable_async_results || local.managed_demo_enabled
      error_message = "Asynchronous results are blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_database || local.managed_demo_enabled
      error_message = "Database is blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_results_worker_runtime || local.managed_demo_enabled
      error_message = "Results-worker runtime is blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_results_worker_runtime || (local.async_results_enabled && local.database_enabled)
      error_message = "Results-worker runtime requires both enable_async_results=true and enable_database=true."
    }

    precondition {
      condition     = !var.enable_results_worker_runtime || trimspace(var.results_worker_image_uri) != ""
      error_message = "results_worker_image_uri is required when enable_results_worker_runtime=true."
    }

    precondition {
      condition     = !var.enable_observability || local.managed_demo_enabled
      error_message = "Observability is blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
    }

    precondition {
      condition     = !var.enable_observability || local.results_worker_enabled
      error_message = "Observability requires enable_results_worker_runtime=true so it has real queue, worker, and database targets."
    }

    precondition {
      condition     = !var.enable_virtual_production_assets || local.managed_demo_enabled
      error_message = "Virtual-production assets are blocked in local mode. Use deployment_mode=demo and allow_managed_demo=true only for an approved, time-boxed test."
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

module "async_results" {
  count  = local.async_results_enabled ? 1 : 0
  source = "./modules/async-results"

  name_prefix = "arthurs-trials-${var.deployment_mode}"
  tags        = local.common_tags
}

# This access slice is deliberately separate from the task definition so its
# security group can be the database's only ingress source without creating a
# Terraform dependency cycle. It creates no task by itself.
module "results_worker_access" {
  count  = local.results_worker_enabled ? 1 : 0
  source = "./modules/results-worker-access"

  name_prefix       = "arthurs-trials-${var.deployment_mode}"
  vpc_id            = module.network[0].vpc_id
  match_results_arn = module.async_results[0].queue_arn
  tags              = local.common_tags
}

# The database is private by construction and starts with zero ingress. Future
# application/worker modules must opt in with security-group references.
module "database" {
  count  = local.database_enabled ? 1 : 0
  source = "./modules/database"

  name_prefix        = "arthurs-trials-${var.deployment_mode}"
  vpc_id             = module.network[0].vpc_id
  private_subnet_ids = module.network[0].private_subnet_ids
  allowed_security_group_ids = local.results_worker_enabled ? [
    module.results_worker_access[0].security_group_id,
  ] : []
  tags = local.common_tags
}

# The service starts at desired count zero. It is a deployment-ready wiring
# template, not permission to run paid compute. Before an approved launch, the
# operator must choose private VPC endpoints or a NAT strategy for ECR, SQS,
# CloudWatch Logs, and Secrets Manager.
module "results_worker_runtime" {
  count  = local.results_worker_enabled ? 1 : 0
  source = "./modules/results-worker-runtime"

  name_prefix             = "arthurs-trials-${var.deployment_mode}"
  cluster_arn             = module.results_worker_access[0].cluster_arn
  execution_role_arn      = module.results_worker_access[0].execution_role_arn
  task_role_name          = module.results_worker_access[0].task_role_name
  task_role_arn           = module.results_worker_access[0].task_role_arn
  security_group_id       = module.results_worker_access[0].security_group_id
  private_subnet_ids      = module.network[0].private_subnet_ids
  match_results_queue_url = module.async_results[0].queue_url
  database_secret_arn     = module.database[0].master_user_secret_arn
  worker_image_uri        = var.results_worker_image_uri
  desired_count           = var.results_worker_desired_count
  tags                    = local.common_tags
}

# Dashboard and alarms are optional operational evidence. Empty alarm actions
# deliberately avoid creating a notification service; an approved operator may
# supply an existing SNS/PagerDuty action ARN later.
module "observability" {
  count  = local.observability_enabled ? 1 : 0
  source = "./modules/observability"

  name_prefix              = "arthurs-trials-${var.deployment_mode}"
  match_results_queue_name = module.async_results[0].queue_name
  dead_letter_queue_name   = module.async_results[0].dead_letter_queue_name
  cluster_name             = module.results_worker_access[0].cluster_name
  service_name             = module.results_worker_runtime[0].service_name
  database_identifier      = module.database[0].instance_identifier
  alarm_actions            = var.observability_alarm_actions
  tags                     = local.common_tags
}

# This optional slice preserves content versions and stage-approval metadata,
# but creates no render workstation or always-on compute. The stage remains
# local; it retrieves an explicitly approved version through a future
# least-privilege integration.
module "virtual_production_assets" {
  count  = local.virtual_production_assets_enabled ? 1 : 0
  source = "./modules/virtual-production-assets"

  name_prefix = "arthurs-trials-${var.deployment_mode}"
  tags        = local.common_tags
}
