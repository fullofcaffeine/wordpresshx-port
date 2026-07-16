#!/usr/bin/env node
import { readFileSync } from "node:fs";

const CANONICAL_NAME = "wordpresshx-port";
const CANONICAL_REPOSITORY = "fullofcaffeine/wordpresshx-port";
const CANONICAL_GIT_URL = `https://github.com/${CANONICAL_REPOSITORY}.git`;
const CANONICAL_DOLT_URL = `git+ssh://git@github.com/${CANONICAL_REPOSITORY}.git`;
const FORMER_REPOSITORY = "fullofcaffeine/wordpress-hx";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition)
    throw new Error(message);
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const identity = JSON.parse(read("manifests/operations/wphx-000-08-project-identity-rename.v1.json"));

assert(packageJson.name === CANONICAL_NAME, `package.json name must be ${CANONICAL_NAME}`);
assert(packageJson.repository?.url === CANONICAL_GIT_URL, `package.json repository must be ${CANONICAL_GIT_URL}`);
assert(packageLock.name === CANONICAL_NAME, `package-lock.json name must be ${CANONICAL_NAME}`);
assert(packageLock.packages?.[""]?.name === CANONICAL_NAME, `package-lock root name must be ${CANONICAL_NAME}`);
assert(identity.identity?.repository_name === CANONICAL_NAME, "identity manifest repository name is stale");
assert(identity.identity?.github_repository === CANONICAL_REPOSITORY, "identity manifest GitHub repository is stale");
assert(identity.validation_result?.status === "passed", "identity manifest does not record a passing migration");

const activeFiles = [
  "README.md",
  "package.json",
  "package-lock.json",
  ".beads/config.yaml",
  "docs/prd/wordpress-haxe-port.md",
  "docs/operations/repositories.md",
  "docs/operations/dependent-libraries.md",
  "docs/operations/beads.md",
  "docs/operations/beads-backup-restore.md",
  "docs/operations/multi-agent.md",
  "docs/operations/license-provenance.md"
];

for (const path of activeFiles) {
  const content = read(path);
  assert(!content.includes(FORMER_REPOSITORY), `${path} still references the former active repository coordinate`);
}

assert(read("README.md").includes(`github.com/${CANONICAL_REPOSITORY}/actions/`), "README CI badge is not canonical");
assert(read(".beads/config.yaml").includes(CANONICAL_DOLT_URL), "Beads sync remote is not canonical");
assert(read("docs/prd/wordpress-haxe-port.md").includes("**Project/repository:** `wordpresshx-port`"), "PRD project identity is stale");
assert(read("docs/operations/dependent-libraries.md").includes("`wordpress-hx-sdk`"), "SDK separation is not recorded");

const stableSchemaIds = {
  "manifests/schemas/inventory-manifests.schema.json": "https://github.com/fullofcaffeine/wordpress-hx/manifests/schemas/inventory-manifests.schema.json",
  "manifests/schemas/ownership-manifest.schema.json": "https://github.com/fullofcaffeine/wordpress-hx/manifests/schemas/ownership-manifest.schema.json",
  "manifests/schemas/php-abi-manifest.schema.json": "https://wordpress-hx.local/schemas/php-abi-manifest.schema.json"
};

for (const [path, expectedId] of Object.entries(stableSchemaIds)) {
  const schema = JSON.parse(read(path));
  assert(schema.$id === expectedId, `${path} changed its published stable $id during the repository rename`);
}

const beadsExport = read(".beads/issues.jsonl");
assert(beadsExport.includes('"external_ref":"WPHX-000.08"'), "Beads export is missing WPHX-000.08");
assert(beadsExport.includes('"id":"wordpresshx-'), "stable wordpresshx-* Beads IDs are missing");

console.log(JSON.stringify({
  status: "passed",
  project: CANONICAL_NAME,
  repository: CANONICAL_REPOSITORY,
  active_files_checked: activeFiles.length,
  stable_schema_ids_checked: Object.keys(stableSchemaIds).length,
  stable_program_identifiers: ["WPHX-*", "wordpresshx-*", "wphx.*"]
}, null, 2));
