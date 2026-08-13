variable "name_prefix" { type = string }
variable "match_results_queue_name" { type = string }
variable "dead_letter_queue_name" { type = string }
variable "cluster_name" { type = string }
variable "service_name" { type = string }
variable "database_identifier" { type = string }
variable "alarm_actions" { type = list(string) }
variable "tags" { type = map(string) }
