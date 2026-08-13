variable "name_prefix" {
  description = "Prefix for virtual-production asset and metadata resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to virtual-production resources."
  type        = map(string)
}
