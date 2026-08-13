resource "aws_db_subnet_group" "private" {
  name       = "${var.name_prefix}-postgres-private"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-private"
    tier = "data"
  })
}

resource "aws_security_group" "postgres" {
  name        = "${var.name_prefix}-postgres"
  description = "Private PostgreSQL access for Arthur's Trials application roles only."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
    tier = "data"
  })
}

# No CIDR ingress is permitted. Future application and worker modules must
# supply their own security-group IDs; a public address can never reach RDS.
resource "aws_vpc_security_group_ingress_rule" "postgres_from_application" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.postgres.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL from an Arthur's Trials application role"
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  instance_class = "db.t4g.micro"

  db_name  = "arthurstrials"
  username = "arthurs_admin"
  port     = 5432

  # RDS stores and rotates the generated credential in Secrets Manager. It is
  # never placed in Terraform variables, source control, or an Unreal client.
  manage_master_user_password = true

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.postgres.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period         = 7
  copy_tags_to_snapshot           = true
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name_prefix}-postgres-final"
  auto_minor_version_upgrade      = true
  apply_immediately               = false
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
    tier = "data"
  })
}
