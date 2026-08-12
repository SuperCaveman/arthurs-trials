import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dockerfilePath = new URL('../containers/server/Dockerfile', import.meta.url);
const dockerfile = await readFile(dockerfilePath, 'utf8');

assert.match(dockerfile, /^FROM public\.ecr\.aws\/amazonlinux\/amazonlinux:2023 AS base$/m);
assert.match(dockerfile, /dnf install -y ca-certificates libcurl-minimal shadow-utils/);
assert.match(dockerfile, /useradd --create-home --shell \/sbin\/nologin arthurs/);
assert.match(dockerfile, /^FROM base AS payload$/m);
assert.match(dockerfile, /^FROM base$/m);
assert.match(dockerfile, /COPY --from=payload --chown=arthurs:arthurs \/opt\/arthurs-trials\/ArthursTrials\/Binaries\/Linux\/ArthursTrialsServer/);
assert.match(dockerfile, /COPY --from=payload --chown=arthurs:arthurs --exclude=\*\.debug --exclude=\*\.sym \/opt\/arthurs-trials\/Engine/);
assert.match(dockerfile, /^USER arthurs$/m);
assert.match(dockerfile, /^EXPOSE 7777\/udp$/m);
assert.match(
  dockerfile,
  /ENTRYPOINT \["\/opt\/arthurs-trials\/ArthursTrials\/Binaries\/Linux\/ArthursTrialsServer"\]/
);
assert.match(dockerfile, /CMD \["-port=7777", "-log"\]/);

console.log('Verified: Linux server image recipe uses a non-root process and the UDP 7777 server contract.');
