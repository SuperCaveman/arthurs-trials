# Release-candidate workflow

Status: **Workflow template validated; no cloud release performed**

The manual **Build release candidate (no deploy)** GitHub Actions workflow
builds the session-API and results-worker images, tests both packages, and
uploads a JSON evidence manifest. The manifest records the source revision and
a SHA-256 digest of each Docker archive, so a reviewer can identify exactly
which locally built artifacts were evaluated.

## Explicit boundary

This is deliberately a preparation workflow, not a delivery workflow:

- it runs only when manually started;
- it has `contents: read` permission only;
- it does not request a GitHub OIDC token;
- it does not configure AWS credentials or log into ECR;
- it does not publish images, run Terraform, or create/update AWS resources;
- its evidence artifact expires after 14 days.

The archive SHA-256 is evidence for a locally built candidate—not an ECR image
digest. A future approved deployment must publish revision-pinned images to
ECR, record the registry digest, and use a separately protected environment
with a narrowly scoped deployment role. That work is intentionally not enabled
here.

## Recording value

For the portfolio, the downloaded manifest gives a compact CI/CD artifact to
show alongside the green workflow: source revision, two build inputs, hashes,
and the explicit `deployment.performed: false` boundary. It supports a mature
delivery discussion without claiming a release that never happened.
