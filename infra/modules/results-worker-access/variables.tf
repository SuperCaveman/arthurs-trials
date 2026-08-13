variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "match_results_arn" {
  type = string
}

variable "tags" {
  type = map(string)
}
