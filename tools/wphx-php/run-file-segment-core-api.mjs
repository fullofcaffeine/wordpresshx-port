#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T09:00:00Z";
const ISSUE = {
  id: "wordpresshx-jcyk",
  external_ref: "WPHX-COMP-PHP-FILE-SEGMENT-CORE-API",
  title: "Replace named script switches with generic file-segment IR"
};
const RUNNER = "tools/wphx-php/run-file-segment-core-api.mjs";
const COMPILER = "src/wphx/compiler/php/WphxPhpCompiler.hx";
const GAP_INVENTORY_RUNNER = "tools/wphx-php/run-compiler-gap-inventory.mjs";
const PROFILE_AUDIT_RUNNER = "tools/wphx-php/run-profile-core-promotion-audit.mjs";
const MANIFEST = "manifests/wphx-php/file-segment-core-api.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-file-segment-core-api.v1.json";
const EVIDENCE_MANIFESTS = [
  "manifests/wp-core/wphx-315-08-admin-hxx-markup-pilot.v1.json",
  "manifests/wphx-php/include-side-effects.v1.json",
  "manifests/wphx-php/whole-file-class-http.v1.json",
  "manifests/wphx-php/template-segment-admin-style.v1.json",
  "manifests/wphx-php/template-segment-nested.v1.json"
];
const EXPECTED_ADAPTERS = [
  "admin-hxx-markup-pilot",
  "deprecated-class-http",
  "include-side-effects",
  "template-segment-admin-style",
  "template-segment-nested-parent",
  "template-segment-nested-partial"
];
const EXPECTED_REGISTRY_FEATURE = "file-segment.plan-registry";
const REQUIRED_COMPILER_PATTERNS = [
  "private typedef PhpFileSegmentPlan",
  "function fileSegmentPlan(",
  "function fileSegmentPlans(",
  "function registerFileSegmentPlan(",
  "recordSegmentPlan(path, plan.adapter, plan.adoptionMode",
  "return emitSegmentPlan(plan.features.concat([\"file-segment.plan-registry\"]), plan.fileSegments);"
];
const DISALLOWED_SWITCH_PATTERNS = EXPECTED_ADAPTERS.map((adapter) => `case "${adapter}":`);

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function normalizeSegmentPlan(plan) {
  return {
    path: plan.path,
    adapter: plan.adapter,
    adoption_mode: plan.adoption_mode,
    segments: plan.segments,
    caller_scope: plan.caller_scope.map((entry) => ({ kind: entry.kind, names: entry.names })),
    include_semantics: plan.include_semantics,
    observable_effects: plan.observable_effects,
    unsupported: plan.unsupported
  };
}

function emittedSegmentPlans(manifest) {
  const fromList = manifest.emission_manifest?.segment_plans ?? [];
  const fromSingle = manifest.emission_manifest?.segment_plan === undefined ? [] : [manifest.emission_manifest.segment_plan];
  const fromWpCoreWphx = manifest.wphx_php?.emission_manifest?.segment_plans ?? [];
  return fromList.concat(fromSingle).concat(fromWpCoreWphx).map(normalizeSegmentPlan);
}

function manifestFeatures(manifest) {
  const features = manifest.emission_manifest?.core_ir_features ?? manifest.wphx_php?.emission_manifest?.core_ir_features ?? [];
  return [...features].sort();
}

function assertStatusPassed(manifest, path) {
  const status = manifest.validation_result?.status ?? manifest.status ?? null;
  if (status !== "passed") {
    throw new Error(`${path} does not report passed status`);
  }
}

function scriptAdapterRegistry(source) {
  const start = source.indexOf("function fileSegmentPlans");
  const end = source.indexOf("function emitFunction", start);
  const slice = start === -1 || end === -1 ? "" : source.slice(start, end);
  const entries = [];
  const adapterPattern = /adapter:\s*"([^"]+)"/g;
  let match;
  while ((match = adapterPattern.exec(slice)) !== null) entries.push(match[1]);
  return [...new Set(entries)].sort();
}

function main() {
  const compilerSource = readFileSync(COMPILER, "utf8");
  const missingCompilerPatterns = REQUIRED_COMPILER_PATTERNS.filter((pattern) => !compilerSource.includes(pattern));
  if (missingCompilerPatterns.length > 0) {
    throw new Error(`Compiler is missing file-segment registry patterns: ${JSON.stringify(missingCompilerPatterns)}`);
  }
  const lingeringSwitches = DISALLOWED_SWITCH_PATTERNS.filter((pattern) => compilerSource.includes(pattern));
  if (lingeringSwitches.length > 0) {
    throw new Error(`Compiler still contains named script switch cases: ${JSON.stringify(lingeringSwitches)}`);
  }

  const registryAdapters = scriptAdapterRegistry(compilerSource);
  assertJsonEqual(registryAdapters, EXPECTED_ADAPTERS, "file-segment registry adapters");

  const evidence = Object.fromEntries(EVIDENCE_MANIFESTS.map((path) => [path, readJson(path)]));
  for (const [path, manifest] of Object.entries(evidence)) {
    assertStatusPassed(manifest, path);
  }

  const allSegmentPlans = Object.values(evidence).flatMap(emittedSegmentPlans);
  const segmentAdapters = allSegmentPlans.map((plan) => plan.adapter).sort();
  assertJsonEqual(segmentAdapters, EXPECTED_ADAPTERS, "segment plan adapters");

  const missingRegistryFeature = Object.entries(evidence)
    .filter(([, manifest]) => !manifestFeatures(manifest).includes(EXPECTED_REGISTRY_FEATURE))
    .map(([path]) => path);
  if (missingRegistryFeature.length > 0) {
    throw new Error(`Missing ${EXPECTED_REGISTRY_FEATURE} in ${JSON.stringify(missingRegistryFeature)}`);
  }

  const unsupportedPlans = allSegmentPlans.filter((plan) => (plan.unsupported ?? []).length !== 0);
  if (unsupportedPlans.length > 0) {
    throw new Error(`Unexpected unsupported segment plans: ${JSON.stringify(unsupportedPlans, null, 2)}`);
  }

  const planCoverage = allSegmentPlans.map((plan) => ({
    adapter: plan.adapter,
    path: plan.path,
    adoption_mode: plan.adoption_mode,
    segments: plan.segments,
    include_semantics: plan.include_semantics,
    observable_effects: plan.observable_effects
  }));

  const manifest = {
    schema: "wphx.wphx-php-file-segment-core-api.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_core_lowering",
    artifact_scope: "file_segment_plan_registry_for_direct_scripts_templates_and_minimized_whole_file",
    inputs: [COMPILER, RUNNER, GAP_INVENTORY_RUNNER, PROFILE_AUDIT_RUNNER, ...EVIDENCE_MANIFESTS].map(inputRecord),
    registry: {
      compiler_path: COMPILER,
      adapter_count: registryAdapters.length,
      adapters: registryAdapters,
      required_patterns: REQUIRED_COMPILER_PATTERNS,
      disallowed_named_switch_patterns_absent: true
    },
    evidence_manifests: EVIDENCE_MANIFESTS.map((path) => {
      const manifest = evidence[path];
      return {
        path,
        bytes: statSync(path).size,
        sha256: sha256File(path),
        status: manifest.validation_result?.status ?? manifest.status,
        has_registry_feature: manifestFeatures(manifest).includes(EXPECTED_REGISTRY_FEATURE),
        segment_plans: emittedSegmentPlans(manifest).map((plan) => plan.adapter)
      };
    }),
    segment_plan_coverage: planCoverage,
    validation_result: {
      status: "passed",
      registry_patterns_present: true,
      named_script_switches_absent: true,
      registry_adapter_count: registryAdapters.length,
      registry_adapters_match_metadata: true,
      segment_plan_adapter_count: segmentAdapters.length,
      segment_plans_unsupported_empty: true,
      downstream_manifests_passed: true,
      registry_feature_recorded_in_downstream_manifests: true
    },
    claims: [
      "WPHX PHP script adapters are now selected through a reusable file-segment plan registry instead of an emitScript name switch.",
      "The existing direct include-side-effects, deprecated class-http, admin-style template segment, nested parent segment, and nested partial segment fixtures still emit segment plans with unsupported=[].",
      "Affected segment/whole-file emission manifests record the file-segment.plan-registry core feature."
    ],
    non_claims: [
      "This does not claim arbitrary mixed PHP/HTML template ownership.",
      "This does not claim full file-scope arbitrary Haxe expression lowering, include graph ownership, or WordPress template directory ownership.",
      "This does not claim WPHX PHP is a mature arbitrary-Haxe PHP backend or that stock Haxe PHP can be abandoned as private implementation emitter."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-file-segment-core-api",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    commands: ["npm run wphx:php:file-segment-core-api", "npm run wphx:php:file-segment-core-api:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic file-segment registry evidence runner"
      },
      {
        path: COMPILER,
        role: "WPHX PHP compiler file-segment plan registry implementation"
      },
      {
        path: MANIFEST,
        role: "file-segment core API manifest"
      },
      {
        path: RECEIPT,
        role: "file-segment core API receipt"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: manifest.validation_result,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");

  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        registry_adapter_count: registryAdapters.length,
        segment_plan_adapter_count: segmentAdapters.length
      },
      null,
      2
    )
  );
}

main();
