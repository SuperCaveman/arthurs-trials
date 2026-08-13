import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [main, variables, module] = await Promise.all([
  read('main.tf'),
  read('variables.tf'),
  read('modules/virtual-production-assets/main.tf'),
]);

assert.match(main, /virtual_production_assets_enabled\s+=\s+local\.managed_demo_enabled && var\.enable_virtual_production_assets/);
assert.match(main, /module "virtual_production_assets"[\s\S]*?count\s+=\s+local\.virtual_production_assets_enabled \? 1 : 0/);
assert.match(variables, /variable "enable_virtual_production_assets"[\s\S]*?default\s+=\s+false/);
assert.match(module, /resource "aws_s3_bucket" "asset_versions"/);
assert.match(module, /resource "aws_s3_bucket_public_access_block" "asset_versions"/);
assert.match(module, /block_public_policy\s+=\s+true/);
assert.match(module, /resource "aws_s3_bucket_versioning" "asset_versions"[\s\S]*?status\s+=\s+"Enabled"/);
assert.match(module, /resource "aws_s3_bucket_server_side_encryption_configuration" "asset_versions"[\s\S]*?sse_algorithm\s+=\s+"AES256"/);
assert.match(module, /noncurrent_version_transition[\s\S]*?noncurrent_days\s+=\s+90[\s\S]*?storage_class\s+=\s+"GLACIER_IR"/);
assert.match(module, /resource "aws_dynamodb_table" "stage_approvals"/);
assert.match(module, /billing_mode\s+=\s+"PAY_PER_REQUEST"/);
assert.match(module, /point_in_time_recovery[\s\S]*?enabled\s+=\s+true/);
assert.match(module, /resource "aws_iam_role" "stage_asset_read"/);
assert.match(module, /resource "aws_iam_role_policy" "stage_asset_read"/);
assert.match(module, /"s3:GetObjectVersion"/);
assert.match(module, /\$\{aws_s3_bucket\.asset_versions\.arn\}\/approved\/\*/);
assert.match(module, /"dynamodb:GetItem"/);
assert.doesNotMatch(module, /"s3:PutObject"|"dynamodb:PutItem"/);
assert.match(main, /virtual_production_stage_trusted_principal_arn is required/);

console.log('Verified: virtual-production storage is private, versioned, recoverable, approval-tracked, stage-read-only, and default-off.');
