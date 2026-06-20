#!/usr/bin/env node
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(errors) {
  console.error(JSON.stringify({ status: "failed", errors }, null, 2));
  process.exit(1);
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

const errors = [];
const policy = readJson("manifests/baseline-policy.v1.json");
const wp = readJson("manifests/upstream/wordpress-7.0-baseline.v1.json");
const embedded = readJson("manifests/upstream/wordpress-7.0-gutenberg-baseline.v1.json");
const forward = readJson("manifests/upstream/gutenberg-forward-baseline.v1.json");
const inventorySummary = readJson("manifests/inventory-summary.v1.json");
const oracle = readJson("manifests/oracle/vanilla-oracle-baseline.v1.json");

const wp70 = policy.profiles["wp70-release"];
const gf = policy.profiles["gutenberg-forward-23.4"];

assert(policy.schema === "wphx.baseline-policy.v1", "baseline policy schema mismatch", errors);
assert(policy.status === "accepted", "baseline policy must be accepted", errors);
assert(wp.id === wp70.wordpress_baseline, "WordPress baseline id does not match wp70 policy", errors);
assert(wp.repository.commit === wp70.wordpress_commit, "WordPress commit does not match wp70 policy", errors);
assert(embedded.wordpress_metadata.gutenberg_sha === wp70.embedded_gutenberg_commit, "embedded Gutenberg SHA does not match wp70 policy", errors);
assert(embedded.gutenberg_source.commit === wp70.embedded_gutenberg_commit, "embedded Gutenberg source commit does not match wp70 policy", errors);
assert(forward.id === gf.forward_baseline, "forward Gutenberg baseline id does not match policy", errors);
assert(forward.repository.commit === gf.gutenberg_commit, "forward Gutenberg commit does not match policy", errors);
assert(forward.repository.commit !== wp70.embedded_gutenberg_commit, "forward Gutenberg commit must remain distinct from embedded wp70 Gutenberg commit", errors);

const sourceBaselines = new Set(Object.keys(inventorySummary.counts.source_by_baseline));
const artifactBaselines = new Set(Object.keys(inventorySummary.counts.artifact_by_baseline));
for (const baseline of wp70.allowed_source_inventory_baselines) {
  assert(sourceBaselines.has(baseline), `wp70 source baseline missing from inventory: ${baseline}`, errors);
}
for (const baseline of wp70.allowed_artifact_baselines) {
  assert(artifactBaselines.has(baseline), `wp70 artifact baseline missing from inventory: ${baseline}`, errors);
}
for (const baseline of gf.allowed_source_inventory_baselines) {
  assert(sourceBaselines.has(baseline), `forward source baseline missing from inventory: ${baseline}`, errors);
}
assert(Array.isArray(gf.allowed_artifact_baselines) && gf.allowed_artifact_baselines.length === 0, "forward Gutenberg profile must not allow distro artifact baselines", errors);
for (const baseline of artifactBaselines) {
  assert(!baseline.startsWith("gutenberg-forward"), `forward artifact baseline must not appear in distro artifacts: ${baseline}`, errors);
}

assert(oracle.upstream.wordpress_commit === wp70.wordpress_commit, "vanilla oracle must use wp70 WordPress commit", errors);
assert(gf.distribution_claim === null, "forward Gutenberg profile must not carry a distribution claim", errors);
assert(wp70.distribution_claim === "wordpress-7.0-compatible", "wp70 release profile must carry the WordPress 7.0 distro claim", errors);

if (errors.length > 0) fail(errors);

console.log(
  JSON.stringify(
    {
      status: "passed",
      policy: "manifests/baseline-policy.v1.json",
      profiles: Object.keys(policy.profiles),
      wp70_embedded_gutenberg: wp70.embedded_gutenberg_commit,
      gutenberg_forward: gf.gutenberg_commit
    },
    null,
    2
  )
);
