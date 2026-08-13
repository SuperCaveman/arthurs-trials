variable "name_prefix" {
  description = "Prefix for identity resources in the explicitly approved managed demo."
  type        = string
}

variable "tags" {
  description = "Tags applied to identity resources."
  type        = map(string)
}
