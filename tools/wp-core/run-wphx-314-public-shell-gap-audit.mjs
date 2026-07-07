#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-08T04:00:00Z";
const ISSUE = {
  id: "wordpresshx-l76.20.8",
  external_ref: "WPHX-314.16",
  title: "Audit and retire blocks/interactivity public PHP shell gaps"
};
const RUNNER = "tools/wp-core/run-wphx-314-public-shell-gap-audit.mjs";
const MANIFEST = "manifests/wp-core/wphx-314-16-public-shell-gap-audit.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-16-public-shell-gap-audit.v1.json";
const OWNERSHIP_DIR = "manifests/ownership";

const DURABLE_STATES = new Set(["compiler_emitted_original_path_shell", "durable_public_adapter", "whole_file_owned"]);
const HAXE_CANDIDATE_STATES = new Set(["haxe_parity_candidate"]);
const COPIED_ORACLE_STATES = new Set(["bridge_oracle_fixture", "bridge_shell", "oracle_mirror_behavior_fixture"]);
const PACKAGE_ROUTER_STATES = new Set(["packaged_distribution_candidate"]);
const EXPECTED_CLASSIFICATION_COUNTS = {
  inventory_only: 1,
  haxe_candidate_without_public_php_replacement: 2,
  copied_oracle_public_surface: 8,
  installed_package_bridge_router: 2,
  durable_generated_public_shell: 0
};
const FOLLOWUP_GATES_BY_REF = {
  "WPHX-314.03": {
    target: "block parser/render original-path adapters",
    blockers: [
      "model WP_Block_Parser, WP_Block_Type, WP_Block_Type_Registry, WP_Block_List, and WP_Block public ABI shape",
      "preserve parse/serialize/render hook timing and PHP array/reference behavior"
    ],
    removal_gate:
      "Replace copied parser/render PHP with WPHX PHP generated original-path adapters and rerun parser/render oracle fixtures, selected upstream PHPUnit, installed rendering, and generated-shape checks."
  },
  "WPHX-314.04": {
    target: "block supports and bindings original-path adapters",
    blockers: [
      "promote support registry, wrapper attributes, block binding registry, and WP_Block binding execution beyond the WPHX-314.15 helper candidate",
      "preserve filters, registry mutation, style/theme.json handoffs, and render callback context"
    ],
    removal_gate:
      "Install generated public adapters for WP_Block_Supports, block bindings, wrapper attributes, and related helpers; then pass WPHX-314.04, WPHX-314.15, selected upstream PHPUnit, and installed block-rendering gates."
  },
  "WPHX-314.05": {
    target: "block pattern registry original-path adapters",
    blockers: [
      "model pattern/category registries, lazy filePath includes, outside-init diagnostics, and remote-pattern normalization",
      "preserve block-hook handoff and theme/pattern file include semantics"
    ],
    removal_gate:
      "Replace copied pattern registry PHP with generated adapters and pass copied-oracle, theme/template, selected upstream PHPUnit, and installed pattern-rendering gates."
  },
  "WPHX-314.06": {
    target: "block hooks insertion original-path adapters",
    blockers: [
      "model hooked-block traversal, ignored metadata mutation, insertion positions, and post-object integration",
      "preserve filter order, block registry state, and serialization behavior"
    ],
    removal_gate:
      "Replace copied block-hooks PHP with generated adapters and pass block-hook oracle, database-backed post/template cases, selected upstream PHPUnit, and installed rendering gates."
  },
  "WPHX-314.07": {
    target: "style engine original-path adapters",
    blockers: [
      "model CSS declarations, rules, processors, context stores, presets, selector validation, and optimization",
      "preserve global styles/theme.json handoffs and baseline upstream failure classification"
    ],
    removal_gate:
      "Replace copied style-engine PHP with generated adapters and pass style-engine oracle, selected upstream PHPUnit, theme/global-style integration, and installed rendering gates."
  },
  "WPHX-314.08": {
    target: "HTML API original-path adapters",
    blockers: [
      "model WP_HTML_Tag_Processor, decoder, token map, bookmarks, namespace handling, and mutation rules",
      "preserve streaming/incomplete-token behavior and special-element escaping"
    ],
    removal_gate:
      "Replace copied HTML API PHP with generated adapters and pass tag-processor oracle, selected upstream PHPUnit, generated-shape checks, and downstream block/interactivity fixtures."
  },
  "WPHX-314.09": {
    target: "interactivity API original-path adapters",
    blockers: [
      "model state/config/context helpers, server directive processors, derived state hydration, router regions, and each-template expansion",
      "preserve browser package handoff to @wordpress/interactivity and baseline upstream failure classification"
    ],
    removal_gate:
      "Replace copied interactivity PHP with generated adapters and pass interactivity oracle, selected upstream PHPUnit, browser/Gutenberg package gates, and installed block-rendering gates."
  },
  "WPHX-314.10": {
    target: "selected core block renderer original-path adapters",
    blockers: [
      "model selected categories, archives, and tag-cloud renderers plus registration callback handoffs",
      "preserve deterministic taxonomy/query/archive helper behavior and HTML API link mutation"
    ],
    removal_gate:
      "Replace copied selected core renderer PHP with generated adapters and pass renderer oracle, database-backed taxonomy/archive cases, selected upstream PHPUnit, and installed rendering gates."
  },
  "WPHX-314.12": {
    target: "block package-root generated overlay manifest",
    blockers: [
      "introduce non-empty candidate overlay manifest before candidate package divergence is trusted",
      "dispatch real installed routes or generated overlays instead of deterministic router-only observations before claiming installed behavior"
    ],
    removal_gate:
      "Replace copied package-root surfaces with generated overlays/adapters and rerun package, upstream PHPUnit, installed database-backed rendering, REST/admin, and browser/editor gates."
  },
  "WPHX-314.14": {
    target: "expanded block package-root generated overlay manifest",
    blockers: [
      "introduce non-empty candidate overlay manifest for expanded package roots",
      "cover REST/admin/template/global-styles routes through real bootstrap or generated overlays before stronger parity claims"
    ],
    removal_gate:
      "Replace copied expanded package-root surfaces with generated overlays/adapters and rerun expanded package, upstream PHPUnit, installed database-backed rendering, REST/admin, template/global-style, and browser/editor gates."
  }
};

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sortedWphx314OwnershipPaths() {
  return readdirSync(OWNERSHIP_DIR)
    .filter((name) => name.startsWith("wphx-314-") && name.endsWith(".json"))
    .sort()
    .map((name) => join(OWNERSHIP_DIR, name));
}

function classify(record) {
  const state = record.ownership_state;
  if (state === "oracle_surface_inventory") return "inventory_only";
  if (DURABLE_STATES.has(state)) return "durable_generated_public_shell";
  if (HAXE_CANDIDATE_STATES.has(state)) return "haxe_candidate_without_public_php_replacement";
  if (COPIED_ORACLE_STATES.has(state)) return "copied_oracle_public_surface";
  if (PACKAGE_ROUTER_STATES.has(state)) return "installed_package_bridge_router";
  return "unclassified";
}

function followupGate(record, classification) {
  if (classification === "copied_oracle_public_surface" || classification === "installed_package_bridge_router") {
    return FOLLOWUP_GATES_BY_REF[record.external_ref] ?? null;
  }
  if (classification === "haxe_candidate_without_public_php_replacement") {
    return {
      target: "promote typed Haxe candidate into generated WPHX PHP original-path adapters",
      blockers: [
        "no WPHX PHP Adapter IR/original-path public adapter currently replaces this WPHX-314 public WordPress boundary",
        "candidate evidence is private/generated-probe or adapter-contract evidence, not public PHP ABI installation"
      ],
      removal_gate:
        "Install through WPHX PHP Adapter IR/original-path generation and rerun the matching copied-oracle fixtures, generated-shape checks, selected upstream PHPUnit, installed rendering, and browser/editor handoff gates before claiming public PHP ownership."
    };
  }
  return null;
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

function main() {
  const paths = sortedWphx314OwnershipPaths();
  const records = paths.map((path) => {
    const manifest = readJson(path);
    return {
      external_ref: manifest.issue?.external_ref ?? null,
      issue_id: manifest.issue?.id ?? null,
      ownership_manifest: path,
      ownership_manifest_sha256: sha256File(path),
      ownership_state: manifest.ownership_state,
      unit_kind: manifest.unit?.kind ?? null,
      unit_name: manifest.unit?.name ?? manifest.unit?.domain ?? null,
      bridge_kind: manifest.bridge?.kind ?? null,
      emission_strategy: manifest.ownership_axes?.emission_strategy ?? null,
      removal_gate: manifest.bridge?.removal_gate ?? null,
      manifest
    };
  });

  const boundaries = records.map((record) => {
    const classification = classify(record);
    return {
      external_ref: record.external_ref,
      issue_id: record.issue_id,
      unit_name: record.unit_name,
      unit_kind: record.unit_kind,
      ownership_state: record.ownership_state,
      shell_gap_classification: classification,
      durable_generated_public_php_claimed: classification === "durable_generated_public_shell",
      public_php_replacement_claimed: classification === "durable_generated_public_shell",
      immediate_retirement_candidate: false,
      bridge_kind: record.bridge_kind,
      emission_strategy: record.emission_strategy,
      ownership_manifest: record.ownership_manifest,
      ownership_manifest_sha256: record.ownership_manifest_sha256,
      removal_gate: record.removal_gate,
      followup_gate: followupGate(record, classification)
    };
  });

  const byClassification = Object.fromEntries(
    [...new Set(boundaries.map((boundary) => boundary.shell_gap_classification))]
      .sort()
      .map((classification) => [classification, boundaries.filter((boundary) => boundary.shell_gap_classification === classification).length])
  );

  const failures = [];
  const unclassified = boundaries.filter((boundary) => boundary.shell_gap_classification === "unclassified");
  const nonDurableDebt = boundaries.filter((boundary) =>
    [
      "haxe_candidate_without_public_php_replacement",
      "copied_oracle_public_surface",
      "installed_package_bridge_router"
    ].includes(boundary.shell_gap_classification)
  );
  const unlinkedDebt = nonDurableDebt.filter((boundary) => boundary.followup_gate === null);

  if (boundaries.length !== 13) failures.push(`expected 13 WPHX-314 ownership manifests, found ${boundaries.length}`);
  for (const [classification, expected] of Object.entries(EXPECTED_CLASSIFICATION_COUNTS)) {
    const actual = byClassification[classification] ?? 0;
    if (actual !== expected) failures.push(`expected ${expected} ${classification} boundaries, found ${actual}`);
  }
  if (unclassified.length > 0) failures.push(`unclassified boundaries: ${unclassified.map((boundary) => boundary.external_ref).join(", ")}`);
  if (unlinkedDebt.length > 0) failures.push(`non-durable public shell debt without follow-up gate: ${unlinkedDebt.map((boundary) => boundary.external_ref).join(", ")}`);
  if (boundaries.some((boundary) => boundary.immediate_retirement_candidate)) {
    failures.push("expected zero immediate retirement candidates until generated WPHX PHP original-path adapters exist");
  }

  const validationResult = {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    boundary_count: boundaries.length,
    classification_counts: byClassification,
    unclassified_count: unclassified.length,
    non_durable_public_shell_debt_count: nonDurableDebt.length,
    non_durable_public_shell_debt_without_followup_count: unlinkedDebt.length,
    all_non_durable_public_shell_debt_linked_to_followup_gate: unlinkedDebt.length === 0 && unclassified.length === 0,
    durable_generated_public_shell_count: byClassification.durable_generated_public_shell ?? 0,
    copied_oracle_public_surface_count: byClassification.copied_oracle_public_surface ?? 0,
    installed_package_bridge_router_count: byClassification.installed_package_bridge_router ?? 0,
    haxe_candidate_without_public_php_replacement_count: byClassification.haxe_candidate_without_public_php_replacement ?? 0,
    immediate_retirement_candidate_count: 0
  };

  if (failures.length > 0) {
    throw new Error(`WPHX-314 public shell gap audit failed:\n${failures.join("\n")}`);
  }

  const manifest = {
    schema: "wphx.wp-core-public-shell-gap-audit.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "public_php_shell_gap_audit",
    artifact_scope: "wphx_314_blocks_interactivity_public_php_boundaries",
    behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    durable_original_path_adapter_claimed: false,
    generated_overlay_claimed: false,
    installed_wordpress_route_execution_claimed: false,
    ownership_inputs: paths.map(fileRecord),
    summary: {
      boundary_count: boundaries.length,
      classification_counts: byClassification,
      durable_generated_public_shell_count: validationResult.durable_generated_public_shell_count,
      copied_oracle_public_surface_count: validationResult.copied_oracle_public_surface_count,
      installed_package_bridge_router_count: validationResult.installed_package_bridge_router_count,
      haxe_candidate_without_public_php_replacement_count:
        validationResult.haxe_candidate_without_public_php_replacement_count,
      immediate_retirement_candidate_count: validationResult.immediate_retirement_candidate_count
    },
    boundaries,
    decision: {
      status: "passed",
      public_shell_debt_audited: true,
      eligible_copied_or_generated_temp_shells_retired_now: false,
      reason_no_immediate_public_shell_retirements:
        "WPHX-314 currently has typed Haxe candidate and copied-oracle/router evidence, but no WPHX PHP Adapter IR or generated original-path public adapter that can replace the audited public WordPress boundaries yet.",
      required_next_actions: [
        "Treat WPHX-314 copied-oracle fixtures as behavior targets and package-router gates as topology/router-observation evidence only.",
        "Promote each copied/router public surface through typed Haxe decision models plus WPHX PHP Adapter IR/generated original-path adapters before claiming public PHP replacement.",
        "For package-root gates, require a non-empty candidate overlay manifest with expected generated overlay paths and zero unexpected candidate package differences before trusting candidate divergence.",
        "Rerun copied-oracle fixtures, generated-shape checks, selected upstream PHPUnit, installed database-backed rendering, REST/admin route, and browser/editor/Gutenberg gates appropriate to each promoted boundary."
      ]
    },
    validation_result: validationResult,
    non_claims: [
      "This audit does not promote WPHX-314 copied oracle fixtures to durable public PHP ownership.",
      "This audit does not claim generated original-path public PHP replacement for blocks, block supports, style engine, HTML API, interactivity, or selected core block renderers.",
      "This audit does not claim whole-file WP_Block, WP_Block_Supports, WP_HTML_Tag_Processor, WP_Interactivity_API, or core block renderer ownership.",
      "This audit does not claim installed WordPress route execution, database-backed block rendering, REST controller dispatch, browser/editor/Gutenberg package behavior, selected upstream PHPUnit pass/pass completeness, generated overlays, or installed distribution parity."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "receipt:wphx-314-16-public-shell-gap-audit",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "public_php_shell_gap_audit",
    artifact_scope: "wphx_314_blocks_interactivity_public_php_boundaries",
    commands: [
      "npm run wp:core:wphx-314-public-shell-gap-audit",
      "npm run wp:core:wphx-314-public-shell-gap-audit:check"
    ],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic WPHX-314 public PHP shell gap audit runner"
      },
      {
        path: MANIFEST,
        role: "machine-readable WPHX-314 public PHP shell gap audit"
      },
      {
        path: "docs/operations/progress-matrix.md",
        role: "program matrix updated with WPHX-314 public PHP shell debt classification"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: [
      "Every current WPHX-314 ownership manifest is classified for public PHP shell ownership state.",
      "WPHX-314 has zero durable generated public PHP shell boundaries at this checkpoint.",
      "All WPHX-314 copied-oracle/router public shell debt is linked to explicit future removal gates before public PHP replacement can be claimed."
    ],
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
        boundary_count: boundaries.length,
        classification_counts: byClassification
      },
      null,
      2
    )
  );
}

main();
