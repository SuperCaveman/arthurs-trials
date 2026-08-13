# Private PostgreSQL foundation

Status: **Terraform template validated locally; not deployed**

This opt-in RDS PostgreSQL slice is the future durable home for player profiles,
match requests, idempotency keys, reward receipts, and the transactional worker
write. It is intentionally not used by the local file-store proof and does not
exist in AWS.

## Security architecture

The Terraform module uses a DB subnet group spanning the two private subnets
already defined by the optional VPC. RDS is not publicly accessible and starts
with **no ingress rules**. A future ECS session API or results-worker security
group must be explicitly passed to the database module before it can connect on
PostgreSQL port 5432. No CIDR rule or Unreal-client connection is permitted.

The instance uses encrypted `gp3` storage, an RDS-managed Secrets Manager
credential (`manage_master_user_password`), automatic minor upgrades, PostgreSQL
and upgrade log exports, and tags copied to snapshots. The password never
appears in Terraform input, source code, client configuration, or logs.

AWS documents that RDS DB subnet groups span at least two Availability Zones,
that private DB instances should not be publicly accessible, and that PostgreSQL
supports backups/point-in-time recovery and private VPC deployments. See
[creating DB instances](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html),
[RDS in a VPC](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html),
and [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html).

## Cost and recovery posture

The proposed `db.t4g.micro` single-AZ instance is a deliberately small
time-boxed demo shape, not a production availability claim. It has 20 GiB
initial encrypted storage, a 50 GiB storage cap, seven-day backups, a final
snapshot requirement, and deletion protection. The database has an ongoing
instance/storage/backup cost when enabled, so it stays behind the existing
`deployment_mode=demo`, explicit consent, and expiry gate.

Before a scheduled teardown, an operator must verify the final snapshot and
then explicitly remove deletion protection in the approved Terraform input.
Production would use Multi-AZ, a tested restore runbook, separate database
roles, connection pooling, alarms, longer retention as required, and likely
read-replica/partitioning decisions based on measured workload.

## Current boundary

No VPC, subnet group, security group, RDS instance, backup, or secret was
created by this work. The local results-worker file store remains a
single-process proof only. A future managed demo must add the application and
worker task security groups, migrate the schema, run an authenticated smoke
test, then demonstrate a restore/teardown path before this can be described as
deployed persistence.
