import { readFile } from "node:fs/promises";

const planPath = process.argv[2];

if (!planPath) {
  throw new Error("Usage: node scripts/assert-local-plan.mjs <terraform-show.json>");
}

// PowerShell's default UTF-8 writer includes a BOM; GitHub Actions' shell
// redirect does not. Accept either so the assertion behaves identically.
const planText = (await readFile(planPath, "utf8")).replace(/^\uFEFF/, "");
const plan = JSON.parse(planText);
const resourceChanges = plan.resource_changes ?? [];

if (resourceChanges.length > 0) {
  const addresses = resourceChanges.map((change) => change.address).join(", ");
  throw new Error(
    `The local Terraform plan must not contain resources. Found: ${addresses}`,
  );
}

console.log("Verified: local Terraform plan contains zero resource changes.");
