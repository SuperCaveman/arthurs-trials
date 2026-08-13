variable "name_prefix" {
  description = "Prefix for virtual-production asset and metadata resources."
  type        = string
}

variable "stage_trusted_principal_arn" {
  description = "Existing IAM principal allowed to assume the read-only stage asset role."
  type        = string
}

variable "tags" {
  description = "Tags applied to virtual-production resources."
  type        = map(string)
}
