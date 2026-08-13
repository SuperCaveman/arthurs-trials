variable "name_prefix" {
  description = "Prefix for the GitHub Actions trust role."
  type        = string
}

variable "github_repository" {
  description = "Repository allowed to request the role, in owner/repository form."
  type        = string
}

variable "oidc_provider_arn" {
  description = "Existing account-level GitHub Actions OIDC provider ARN."
  type        = string
}

variable "tags" {
  description = "Tags applied to the role."
  type        = map(string)
}
