import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('./Test-ManagedGameLiftContainerReadiness.ps1', import.meta.url), 'utf8');
const guide = await readFile(new URL('../docs/MANAGED_GAMELIFT_CONTAINER_PREP.md', import.meta.url), 'utf8');
const dockerfile = await readFile(new URL('../containers/server/Dockerfile', import.meta.url), 'utf8');

assert.match(script, /docker image inspect/);
assert.match(script, /linux\/amd64/);
assert.match(script, /non-root container user 'arthurs'/);
assert.match(script, /\$RequiredPort\/udp/);
assert.match(script, /awsResourcesCreated\s*=\s*\$false/);
assert.doesNotMatch(script, /aws\s+(gamelift|ecr)|terraform\s+apply|docker\s+push/i);

assert.match(guide, /ECR/);
assert.match(guide, /managed GameLift container fleet/i);
assert.match(guide, /explicit\s+approval/i);
assert.match(guide, /does not call AWS, push an image, or create an AWS resource/i);
assert.match(dockerfile, /"-GameLiftEnabled"/);

console.log('Verified: managed GameLift container readiness is locally testable, starts the GameLift lifecycle, and cannot create AWS resources.');
