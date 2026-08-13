variable "name_prefix" {
  description = "Prefix for asynchronous match-results queues."
  type        = string
}

variable "tags" {
  description = "Tags applied to queues."
  type        = map(string)
}
