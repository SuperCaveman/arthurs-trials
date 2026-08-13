output "cluster_arn" {
  value = aws_ecs_cluster.results.arn
}

output "cluster_name" {
  value = aws_ecs_cluster.results.name
}

output "security_group_id" {
  value = aws_security_group.worker.id
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "task_role_name" {
  value = aws_iam_role.task.name
}
