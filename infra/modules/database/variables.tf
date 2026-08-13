variable "name_prefix" {
  description = "Prefix for private PostgreSQL resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC that contains the private database subnets."
  type        = string
}

variable "private_subnet_ids" {
  description = "At least two private subnets in distinct Availability Zones."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Application/worker security groups allowed to connect to PostgreSQL. Empty means no ingress."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to database resources."
  type        = map(string)
}
