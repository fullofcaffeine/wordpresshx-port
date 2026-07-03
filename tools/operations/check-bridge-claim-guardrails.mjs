#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const checkOnly = process.argv.includes("--check");

const ISSUE = {
  id: "wordpresshx-fyqs",
  external_ref: "WPHX-315.09",
  title: "Add bridge-router overlay and durable-claim guardrails"
};
const RECORDED_AT = "2026-07-03T00:00:00.000Z";
const GENERATOR = "tools/operations/check-bridge-claim-guardrails.mjs";
const OUT = "manifests/operations/bridge-claim-guardrails.v1.json";
const RECEIPT = "receipts/operations/wphx-315-09-bridge-claim-guardrails.v1.json";
const SCAN_ROOTS = ["manifests", "receipts"];
const SELF_OUTPUTS = new Set([OUT, RECEIPT]);

const BRIDGE_SIGNAL_RE = /(copied|router|upstream[_ -]?public[_ -]?php|upstream[_ -]?source|oracle[_ -]?source|oracle[_ -]?mirror|bridge[_ -]?router)/i;
const PUBLIC_BRIDGE_KIND_RE = /(copied.*public.*php|public.*php.*copied|router|package|upstream[_ -]?public[_ -]?php|oracle.*public.*php)/i;
const BRIDGE_STATE_RE = /(bridge_shell|oracle[_ -]?mirror|copied|installed_style_package_gate_with_copied_oracle_php)/i;
const BRIDGE_EVIDENCE_RE = /(copied|bridge[_ -]?router|router[_ -]?observation|package[_ -]?topology)/i;
const DURABLE_STATE_RE = /^(compiler_emitted_original_path_shell|durable_public_adapter|whole_file_owned|verified_haxe_owned)$/i;

function walkJson(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJson(path));
    } else if (path.endsWith(".json") && !SELF_OUTPUTS.has(path)) {
      files.push(path);
    }
  }
  return files.sort();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function flatten(value, prefix = "", out = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, prefix ? `${prefix}.${index}` : `${index}`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      flatten(entry, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push({ path: prefix, value });
  return out;
}

function leaf(path) {
  const parts = path.split(".");
  return parts[parts.length - 1];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function directBridgeTriggers(flatEntries) {
  const triggers = [];
  for (const entry of flatEntries) {
    if (typeof entry.value !== "string") continue;
    const key = leaf(entry.path);
    const value = entry.value;

    if ((entry.path === "ownership_axes.emission_strategy" || entry.path === "emission_strategy") && BRIDGE_SIGNAL_RE.test(value)) {
      triggers.push({ field: entry.path, value, reason: "bridge_or_copied_emission_strategy" });
    } else if ((entry.path === "bridge.kind" && PUBLIC_BRIDGE_KIND_RE.test(value)) || (entry.path === "bridge_kind" && PUBLIC_BRIDGE_KIND_RE.test(value))) {
      triggers.push({ field: entry.path, value, reason: "bridge_kind_uses_copied_router_or_upstream_php" });
    } else if ((entry.path === "evidence_class" || /^evidence_classes\.\d+$/.test(entry.path)) && BRIDGE_EVIDENCE_RE.test(value)) {
      triggers.push({ field: entry.path, value, reason: "bridge_router_or_copied_evidence_class" });
    } else if (entry.path === "ownership_state" && BRIDGE_STATE_RE.test(value)) {
      triggers.push({ field: entry.path, value, reason: "bridge_or_copied_ownership_state" });
    }
  }
  return triggers;
}

function guardedClaimRecords(flatEntries) {
  const claims = [];
  for (const entry of flatEntries) {
    const key = leaf(entry.path);
    if (entry.value === true) {
      if (key === "behavior_parity_claimed") {
        claims.push({ field: entry.path, value: true, kind: "broad_behavior_parity" });
      } else if (key === "public_php_replacement_claimed" || key === "generated_public_php_replacement_claimed") {
        claims.push({ field: entry.path, value: true, kind: "public_php_replacement" });
      } else if (key === "durable_original_path_adapter_claimed") {
        claims.push({ field: entry.path, value: true, kind: "durable_original_path_adapter" });
      } else if (key === "installed_wordpress_route_execution_claimed") {
        claims.push({ field: entry.path, value: true, kind: "installed_wordpress_route_execution" });
      } else if (/installed.*parity.*claimed/i.test(key)) {
        claims.push({ field: entry.path, value: true, kind: "installed_wordpress_parity" });
      } else if (key === "candidate_generated_overlay_claimed") {
        claims.push({ field: entry.path, value: true, kind: "candidate_generated_overlay" });
      } else if (/whole[_-]?file.*claimed/i.test(key) || /whole.*ownership.*claimed/i.test(key)) {
        claims.push({ field: entry.path, value: true, kind: "whole_file_or_full_file_ownership" });
      }
    } else if (typeof entry.value === "string" && (key === "ownership_state" || key === "adoption_mode") && DURABLE_STATE_RE.test(entry.value)) {
      claims.push({ field: entry.path, value: entry.value, kind: "durable_ownership_state" });
    }
  }
  return claims;
}

function presentGuardedClaimFields(flatEntries) {
  return flatEntries
    .filter((entry) => {
      const key = leaf(entry.path);
      return (
        key === "behavior_parity_claimed" ||
        key === "public_php_replacement_claimed" ||
        key === "generated_public_php_replacement_claimed" ||
        key === "durable_original_path_adapter_claimed" ||
        key === "installed_wordpress_route_execution_claimed" ||
        /installed.*parity.*claimed/i.test(key) ||
        key === "candidate_generated_overlay_claimed" ||
        /whole[_-]?file.*claimed/i.test(key) ||
        /whole.*ownership.*claimed/i.test(key)
      );
    })
    .map((entry) => ({ field: entry.path, value: entry.value }));
}

function collectOverlayReferences(value, refs = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectOverlayReferences(entry, refs);
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "candidate_overlay_manifest") {
      if (typeof entry === "string") refs.push(entry);
      if (entry && typeof entry === "object" && typeof entry.path === "string") refs.push(entry.path);
    } else if (key === "candidate_overlay_manifests") {
      for (const item of asArray(entry)) {
        if (typeof item === "string") refs.push(item);
        if (item && typeof item === "object" && typeof item.path === "string") refs.push(item.path);
      }
    } else {
      collectOverlayReferences(entry, refs);
    }
  }
  return refs;
}

function collectInlineOverlayRecords(value, overlays = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectInlineOverlayRecords(entry, overlays);
    return overlays;
  }
  if (!value || typeof value !== "object") return overlays;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "candidate_overlay_paths") {
      overlays.push({ location: "inline:candidate_overlay_paths", records: entry, parent: value });
    } else {
      collectInlineOverlayRecords(entry, overlays);
    }
  }
  return overlays;
}

function validateOverlayRecord(record, location, index) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return [`${location}[${index}] must be an object`];
  }
  if (typeof record.path !== "string" || record.path.length === 0) errors.push(`${location}[${index}].path is required`);
  if (typeof record.source !== "string" || !/(generated|wphx|compiler|adapter)/i.test(record.source)) {
    errors.push(`${location}[${index}].source must name a generated WPHX/compiler source`);
  }
  if (typeof record.replaces_upstream_sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/.test(record.replaces_upstream_sha256)) {
    errors.push(`${location}[${index}].replaces_upstream_sha256 must be a sha256 digest`);
  }
  const evidenceField = ["adapter_ir_manifest", "adapter_manifest", "compiler_manifest", "wphx_php_manifest", "source_manifest"].find(
    (field) => typeof record[field] === "string" && record[field].length > 0
  );
  if (!evidenceField) {
    errors.push(`${location}[${index}] must reference adapter_ir_manifest, adapter_manifest, compiler_manifest, wphx_php_manifest, or source_manifest`);
  }
  return errors;
}

function validateOverlay(records, parent, location) {
  const errors = [];
  if (!Array.isArray(records) || records.length === 0) {
    errors.push(`${location}.candidate_overlay_paths must be a non-empty array`);
    return { valid: false, errors, count: 0 };
  }
  records.forEach((record, index) => errors.push(...validateOverlayRecord(record, location, index)));
  if (!Array.isArray(parent?.unexpected_candidate_package_differences)) {
    errors.push(`${location}.unexpected_candidate_package_differences must be an array`);
  } else if (parent.unexpected_candidate_package_differences.length !== 0) {
    errors.push(`${location}.unexpected_candidate_package_differences must be empty`);
  }
  return { valid: errors.length === 0, errors, count: records.length };
}

function overlayEvidenceFor(path, json) {
  const overlays = [];
  const errors = [];

  for (const ref of collectOverlayReferences(json)) {
    if (!existsSync(ref)) {
      errors.push(`${path} references missing candidate overlay manifest ${ref}`);
      continue;
    }
    const overlayJson = readJson(ref);
    const result = validateOverlay(overlayJson.candidate_overlay_paths, overlayJson, ref);
    if (result.valid) {
      overlays.push({ location: ref, candidate_overlay_path_count: result.count });
    } else {
      errors.push(...result.errors);
    }
  }

  for (const inline of collectInlineOverlayRecords(json)) {
    const result = validateOverlay(inline.records, inline.parent, `${path}:${inline.location}`);
    if (result.valid) {
      overlays.push({ location: `${path}:${inline.location}`, candidate_overlay_path_count: result.count });
    } else {
      errors.push(...result.errors);
    }
  }

  return {
    valid: overlays.length > 0 && errors.length === 0,
    overlays,
    errors
  };
}

function writeOrCheck(path, text) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run operations:bridge-claim-guardrails`);
    const current = readFileSync(path, "utf8");
    if (current !== text) throw new Error(`${path} is stale; run npm run operations:bridge-claim-guardrails`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const jsonFiles = SCAN_ROOTS.flatMap(walkJson);
const documents = new Map();
const bridgeTriggers = new Map();

for (const path of jsonFiles) {
  const json = readJson(path);
  const flatEntries = flatten(json);
  documents.set(path, { json, flatEntries });
  const direct = directBridgeTriggers(flatEntries);
  if (direct.length > 0) bridgeTriggers.set(path, direct);
}

for (const [path, document] of documents) {
  if (!path.startsWith("manifests/ownership/")) continue;
  const direct = bridgeTriggers.get(path);
  if (!direct?.length) continue;
  for (const ownedPath of [...asArray(document.json.owned_paths), ...asArray(document.json.generated_paths)]) {
    if (!ownedPath.endsWith(".json") || SELF_OUTPUTS.has(ownedPath)) continue;
    const propagated = bridgeTriggers.get(ownedPath) ?? [];
    propagated.push({ field: "owned_paths/generated_paths", value: path, reason: "owned_by_bridge_or_copied_ownership_manifest" });
    bridgeTriggers.set(ownedPath, propagated);
  }
}

const guardedClaimFiles = [];
const violations = [];
let overlayManifestCount = 0;
let overlayPathCount = 0;

for (const [path, triggers] of [...bridgeTriggers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const document = documents.get(path);
  if (!document) continue;
  const presentClaims = presentGuardedClaimFields(document.flatEntries);
  const trueClaims = guardedClaimRecords(document.flatEntries);
  const overlay = overlayEvidenceFor(path, document.json);
  overlayManifestCount += overlay.overlays.length;
  overlayPathCount += overlay.overlays.reduce((count, item) => count + item.candidate_overlay_path_count, 0);

  if (presentClaims.length > 0 || trueClaims.length > 0 || overlay.overlays.length > 0) {
    guardedClaimFiles.push({
      path,
      bridge_triggers: triggers,
      guarded_claim_fields: presentClaims,
      true_guarded_claims: trueClaims,
      generated_overlay_evidence: overlay.overlays
    });
  }

  if (trueClaims.length > 0 && !overlay.valid) {
    violations.push({
      path,
      bridge_triggers: triggers,
      true_guarded_claims: trueClaims,
      overlay_errors: overlay.errors.length > 0 ? overlay.errors : ["non-empty generated candidate overlay manifest is required for bridge/copy/router durable claims"]
    });
  }
}

const validationResult = {
  status: violations.length === 0 ? "passed" : "failed",
  scanned_json_files: jsonFiles.length,
  bridge_evidence_file_count: bridgeTriggers.size,
  guarded_claim_file_count: guardedClaimFiles.length,
  generated_overlay_manifest_count: overlayManifestCount,
  generated_overlay_path_count: overlayPathCount,
  violation_count: violations.length
};

const manifest = {
  schema: "wphx.bridge-claim-guardrails.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: GENERATOR,
  policy: {
    copied_router_bridge_evidence_scope:
      "Copied package roots, copied public PHP, deterministic routers, and bridge-router observation gates are temporary bridge evidence unless a generated candidate overlay manifest upgrades the claim.",
    rejected_without_generated_overlay: [
      "behavior_parity_claimed=true on copied/router/bridge public PHP evidence",
      "public_php_replacement_claimed=true",
      "durable_original_path_adapter_claimed=true",
      "installed_wordpress_route_execution_claimed=true",
      "full installed WordPress parity claims",
      "whole-file or durable ownership states"
    ],
    overlay_manifest_contract: {
      candidate_overlay_paths: "non-empty array",
      required_per_overlay_path: ["path", "source", "replaces_upstream_sha256", "adapter_ir_manifest|adapter_manifest|compiler_manifest|wphx_php_manifest|source_manifest"],
      unexpected_candidate_package_differences: "must be an empty array"
    }
  },
  guarded_claim_files: guardedClaimFiles,
  validation_result: validationResult,
  violations
};

if (violations.length > 0) {
  console.error(JSON.stringify({ status: "failed", validation_result: validationResult, violations }, null, 2));
  process.exit(1);
}

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const receipt = {
  schema: "wphx.operations-receipt.v1",
  id: "receipt:wphx-315-09-bridge-claim-guardrails",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  status: "passed",
  command: "npm run operations:bridge-claim-guardrails",
  evidence_class: "claim_guardrail",
  artifact_scope: "copied_package_root_and_bridge_router_claims",
  artifacts: [
    { path: OUT, role: "bridge/copy/router durable-claim guardrail manifest", sha256: manifestSha },
    { path: GENERATOR, role: "guardrail validator script" },
    { path: "package.json", role: "precommit integration for guardrail check" }
  ],
  validation_result: validationResult,
  claims: [
    "The guardrail scans manifests and receipts for copied public PHP, copied package roots, deterministic routers, bridge-router evidence, and propagated ownership-manifest bridge scopes.",
    "The guardrail fails when such bridge evidence claims broad behavior parity, public PHP replacement, installed route execution/parity, durable original-path adapter ownership, or whole-file ownership without non-empty generated candidate overlay evidence.",
    "The guardrail validates overlay records for path, generated source, adapter/compiler manifest evidence, replaced upstream hash, and empty unexpected candidate package differences."
  ],
  non_claims: [
    "This receipt does not create generated candidate overlays.",
    "This receipt does not promote any copied/router bridge gate to durable public PHP ownership.",
    "This receipt does not prove installed WordPress route execution, browser/e2e behavior, database-backed state, or HXX-owned template compilation."
  ]
};

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      receipt: RECEIPT,
      ...validationResult
    },
    null,
    2
  )
);
