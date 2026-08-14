# Managed foundation demo evidence

Date: 2026-08-13

## Scope

An explicitly approved, time-boxed Terraform demonstration created the
low-cost multiplayer control-plane foundation in `us-east-1`:

- a two-AZ VPC with two public and two private subnets;
- no NAT gateway and no EC2 instances;
- a Cognito player pool and public Unreal app client with no client secret;
- an encrypted match-results SQS queue and encrypted dead-letter queue.

The queue completed a real synthetic result round trip. A separate synthetic
poison event exceeded the configured receive limit, was observed in the DLQ,
and was removed. No player data, AWS credentials, session identifiers, or
account identifiers are retained in this evidence.

## Teardown proof

Terraform's saved destroy plan reported `0 to add, 0 to change, 17 to destroy`.
It then completed with `0 added, 0 changed, 17 destroyed`. Terraform state is
empty. Direct AWS lookups confirm the demonstration VPC, Cognito pool, queues,
and subnets no longer exist; tag-index results may persist briefly after
deletion and are not treated as live-resource evidence.

## Boundary

This proved the cloud identity, network, queue, encryption, dead-letter, and
teardown foundations. It did not create managed GameLift hosting, ECR, ECS,
RDS, GPU resources, or always-on compute.
