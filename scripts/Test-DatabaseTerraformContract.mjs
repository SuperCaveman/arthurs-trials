import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [main, variables, module] = await Promise.all([
  read('main.tf'),
  read('variables.tf'),
  read('modules/database/main.tf'),
]);

assert.match(main, /database_enabled\s+=\s+local\.managed_demo_enabled && var\.enable_database/);
assert.match(main, /module "database"[\s\S]*?count\s+=\s+local\.database_enabled \? 1 : 0/);
assert.match(variables, /variable "enable_database"[\s\S]*?default\s+=\s+false/);
assert.match(module, /resource "aws_db_subnet_group" "private"/);
assert.match(module, /resource "aws_security_group" "postgres"/);
assert.match(module, /resource "aws_vpc_security_group_ingress_rule" "postgres_from_application"/);
assert.match(module, /manage_master_user_password\s+=\s+true/);
assert.match(module, /storage_encrypted\s+=\s+true/);
assert.match(module, /publicly_accessible\s+=\s+false/);
assert.match(module, /deletion_protection\s+=\s+true/);
assert.match(module, /backup_retention_period\s+=\s+7/);
assert.match(module, /multi_az\s+=\s+false/);
assert.doesNotMatch(module, /cidr_ipv4|cidr_blocks/);

console.log('Verified: private PostgreSQL is encrypted, access-denied by default, and gated from local mode.');
