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
assert.match(module, /\$\{aws_s3_bucket\.asset_versions\.arn\}\/approved\/productions\/\$\{var\.production_id\}\/\*/);
assert.match(module, /"dynamodb:GetItem"/);
assert.doesNotMatch(module, /"s3:PutObject"|"dynamodb:PutItem"/);
assert.match(main, /virtual_production_stage_trusted_principal_arn is required/);
assert.match(main, /virtual_production_production_id must be a lowercase production identifier/);
assert.match(module, /resource "aws_s3_bucket_notification" "asset_versions"[\s\S]*?eventbridge\s+=\s+true/);
assert.match(module, /resource "aws_cloudwatch_event_rule" "incoming_asset_upload"/);
assert.match(module, /"aws\.s3"/);
assert.match(module, /prefix\s+=\s+"incoming\/"/);
assert.match(module, /resource "aws_sfn_state_machine" "asset_validation"/);
assert.match(module, /type\s+=\s+"STANDARD"/);
assert.match(module, /arn:aws:states:::aws-sdk:s3:headObject/);
assert.match(module, /resource "aws_cloudwatch_log_group" "asset_validation"[\s\S]*?retention_in_days\s+=\s+14/);
assert.match(module, /resource "aws_cloudwatch_event_target" "incoming_asset_validation"/);
assert.match(module, /"states:StartExecution"/);

console.log('Verified: virtual-production storage is private, versioned, recoverable, approval-tracked, intake-validated, stage-read-only, and default-off.');
