import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const statuses = ['Uploaded', 'Processing', 'Validated', 'Approved for Stage', 'Deployed'];

function validateManifest(manifest) {
  if (!/^[a-z0-9-]{3,64}$/.test(manifest?.production ?? '')) throw new Error('production must be a lowercase project identifier.');
  if (!/^[A-Za-z0-9_]{3,64}$/.test(manifest?.assetName ?? '')) throw new Error('assetName must be an identifier.');
  if (!Number.isInteger(manifest?.version) || manifest.version < 1 || manifest.version > 9999) throw new Error('version must be an integer from 1 through 9999.');
  if (!Array.isArray(manifest?.checks?.requiredFiles) || manifest.checks.requiredFiles.length < 1) throw new Error('checks.requiredFiles must list at least one required file.');
  if (!Number.isInteger(manifest?.checks?.estimatedBytes) || manifest.checks.estimatedBytes < 1) throw new Error('checks.estimatedBytes must be a positive integer.');
  const expectedPackage = `${manifest.assetName}_v${manifest.version}.umap`;
  if (manifest?.source?.package !== expectedPackage) throw new Error(`source.package must be ${expectedPackage}.`);
  if (!manifest.checks.requiredFiles.includes(expectedPackage)) throw new Error('checks.requiredFiles must include the Unreal map package.');
  if (manifest.checks.requiredFiles.some((file) => typeof file !== 'string' || file.includes('..') || /[\\/]/.test(file))) throw new Error('checks.requiredFiles must be simple artifact filenames without path traversal.');
}

export function assetVersionId(manifest) {
  validateManifest(manifest);
  return `${manifest.assetName}_v${manifest.version}`;
}

export function productionAssetPrefix(manifest) {
  validateManifest(manifest);
  return `productions/${manifest.production}`;
}

export function createAssetWorkflow(manifest, { approvedBy = 'portfolio-operator' } = {}) {
  const versionId = assetVersionId(manifest);
  const manifestDigest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const timestamp = new Date().toISOString();
  const expectedPackage = `${manifest.assetName}_v${manifest.version}.umap`;
  const transitions = statuses.map((status, index) => ({
    status,
    at: timestamp,
    actor: index < 3 ? 'automated-pipeline' : index === 3 ? approvedBy : 'local-stage-workstation-demo',
  }));
  return {
    workload: 'virtual-production',
    mode: 'local-simulation',
    versionId,
    production: manifest.production,
    asset: { package: manifest.source.package, manifestSha256: manifestDigest, estimatedBytes: manifest.checks.estimatedBytes, storagePrefix: productionAssetPrefix(manifest) },
    source: manifest.source,
    validation: {
      type: 'local-structural-preflight',
      status: 'Passed',
      checks: ['versioned Unreal map package matches asset/version', 'required map package declared', 'artifact filenames reject path traversal'],
      expectedPackage,
    },
    stageTarget: manifest.stageTarget,
    transitions,
    currentStatus: statuses.at(-1),
    productionMapping: {
      upload: 'S3 versioned object storage',
      processing: 'EventBridge + Step Functions/Lambda validation',
      approval: 'Authenticated production approval record',
      deployment: 'Stage workstation retrieves only an approved version',
      retention: 'S3 lifecycle/archive policy',
    },
    scope: 'Local deterministic simulation only. No S3 bucket, IAM role, event bus, workflow, database, or stage workstation is deployed.',
  };
}

export async function runAssetWorkflow({ manifestPath, outputPath, approvedBy }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const workflow = createAssetWorkflow(manifest, { approvedBy });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
  return workflow;
}
