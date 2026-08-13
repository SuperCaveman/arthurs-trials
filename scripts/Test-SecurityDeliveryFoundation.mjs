import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [main, variables, identity, oidc, workflow] = await Promise.all([
  read('main.tf'),
  read('variables.tf'),
  read('modules/identity/main.tf'),
  read('modules/github-oidc/main.tf'),
  read('../.github/workflows/ci.yml'),
]);

assert.match(main, /identity_enabled\s+=\s+local\.managed_demo_enabled && var\.enable_identity/);
assert.match(main, /github_oidc_enabled\s+=\s+local\.managed_demo_enabled && var\.enable_github_actions_oidc/);
assert.match(main, /module "identity"[\s\S]*?count\s+=\s+local\.identity_enabled \? 1 : 0/);
assert.match(main, /module "github_oidc"[\s\S]*?count\s+=\s+local\.github_oidc_enabled \? 1 : 0/);
assert.match(variables, /variable "enable_identity"[\s\S]*?default\s+=\s+false/);
assert.match(variables, /variable "enable_github_actions_oidc"[\s\S]*?default\s+=\s+false/);
assert.match(identity, /generate_secret\s+=\s+false/);
assert.match(identity, /prevent_user_existence_errors\s+=\s+"ENABLED"/);
assert.match(identity, /software_token_mfa_configuration/);
assert.match(oidc, /sts:AssumeRoleWithWebIdentity/);
assert.match(oidc, /token\.actions\.githubusercontent\.com:aud/);
assert.match(oidc, /token\.actions\.githubusercontent\.com:sub/);
assert.match(oidc, /refs\/heads\/main/);
assert.doesNotMatch(oidc, /access_key|AdministratorAccess|\*"\s*\]/i);
assert.doesNotMatch(workflow, /terraform apply/i);

console.log('Verified: identity and GitHub OIDC are default-off, constrained, and cannot deploy from CI.');
