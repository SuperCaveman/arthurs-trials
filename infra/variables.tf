variable "deployment_mode" {
  description = "local creates no AWS resources; demo permits the opt-in network plan."
  type        = string
  default     = "local"

  validation {
    condition     = contains(["local", "demo"], var.deployment_mode)
    error_message = "deployment_mode must be local or demo."
  }
}

variable "allow_managed_demo" {
  description = "Explicit human confirmation required before any managed-demo resource is planned."
  type        = bool
  default     = false
}

variable "aws_region" {
  description = "The one region used by the optional managed demonstration."
  type        = string
  default     = "us-east-1"
}

variable "owner" {
  description = "Owner tag required on every optional managed-demo resource."
  type        = string
  default     = "andrew-bush"
}

variable "expires_at" {
  description = "UTC expiration timestamp for the optional managed-demo resources."
  type        = string
  default     = "UNSET"
}

variable "vpc_cidr" {
  description = "IPv4 range for the optional two-AZ demo VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "enable_identity" {
  description = "Opt in to the Cognito foundation only during an approved managed demo."
  type        = bool
  default     = false
}

variable "enable_github_actions_oidc" {
  description = "Opt in to the permissionless GitHub Actions OIDC trust role only during an approved managed demo."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository allowed in the future OIDC trust policy."
  type        = string
  default     = "SuperCaveman/arthurs-trials"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use owner/repository form."
  }
}

variable "github_actions_oidc_provider_arn" {
  description = "Existing AWS IAM GitHub Actions OIDC provider ARN; required only when its trust role is enabled."
  type        = string
  default     = ""
}
