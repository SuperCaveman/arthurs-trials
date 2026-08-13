import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/release-candidate.yml', import.meta.url), 'utf8');
const manifest = await readFile(new URL('./Generate-ReleaseCandidateManifest.mjs', import.meta.url), 'utf8');

assert.match(workflow, /^\s*workflow_dispatch:/m);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);
assert.match(workflow, /Generate-ReleaseCandidateManifest\.mjs/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.doesNotMatch(workflow, /id-token:\s*write/);
assert.doesNotMatch(workflow, /configure-aws-credentials/);
assert.doesNotMatch(workflow, /docker login/);
assert.doesNotMatch(workflow, /terraform apply/);
assert.doesNotMatch(workflow, /docker push/);
assert.match(manifest, /docker', \['save', image\]/);
assert.match(manifest, /archiveSha256/);
assert.match(manifest, /performed: false/);

console.log('Verified: the release-candidate workflow builds auditable local artifacts with no cloud credential, registry, or deploy path.');
