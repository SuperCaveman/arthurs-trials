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
