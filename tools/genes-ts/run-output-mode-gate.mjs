#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const checkOnly = new Set(process.argv.slice(2)).has("--check");

const ISSUE = {
  id: "wordpresshx-w91.2.1",
  external_ref: "WPHX-401",
  title: "WPHX-401 — Pin and build genes-ts in both output modes"
};
const RECORDED_AT = "2026-07-10T03:45:00.000Z";
const RUNNER = "tools/genes-ts/run-output-mode-gate.mjs";
const MANIFEST = "manifests/genes-ts/wphx-401-output-modes.v1.json";
const RECEIPT = "receipts/genes-ts/wphx-401-output-modes.v1.json";
const TOOLCHAIN_LOCK = "toolchain.lock.json";
const UPSTREAM_LOCK = "upstream.lock.json";
const GENES_REPO = resolve("../genes");
const ALLOWED_UNTRACKED = new Set(["?? genes-ts.xml", "?? repomix-output-genes-ts.xml.zip"]);

function command(name, args, options = {}) {
  return execFileSync(name, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path, role) {
  return { path, role, bytes: statSync(path).size, sha256: sha256File(path) };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function lockedState() {
  const toolchain = JSON.parse(readFileSync(TOOLCHAIN_LOCK, "utf8"));
  const upstream = JSON.parse(readFileSync(UPSTREAM_LOCK, "utf8"));
  const genes = toolchain.libraries.genes_ts;
  const upstreamEntries = upstream.repositories ?? upstream.upstreams ?? upstream;
  const upstreamGenes = upstreamEntries.find((entry) => entry.id === "genes-ts");
  if (!upstreamGenes) throw new Error("upstream.lock.json is missing genes-ts");
  if (genes.commit !== upstreamGenes.git.commit) throw new Error("genes-ts lock commits disagree");
  const actualCommit = command("git", ["rev-parse", "HEAD"], { cwd: GENES_REPO });
  const actualTree = command("git", ["rev-parse", "HEAD^{tree}"], { cwd: GENES_REPO });
  if (actualCommit !== genes.commit) throw new Error(`genes-ts checkout ${actualCommit} does not match pin ${genes.commit}`);
  if (actualTree !== genes.tree) throw new Error(`genes-ts tree ${actualTree} does not match pin ${genes.tree}`);
  const statusLines = command("git", ["status", "--porcelain"], { cwd: GENES_REPO })
    .split("\n")
    .filter(Boolean);
  const unexpected = statusLines.filter((line) => !ALLOWED_UNTRACKED.has(line));
  if (unexpected.length > 0) throw new Error(`genes-ts checkout has unexpected changes:\n${unexpected.join("\n")}`);
  const nodeBin = dirname(toolchain.tools.haxe.executable);
  const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH}` };
  const nodeVersion = command("node", ["--version"], { env });
  if (nodeVersion !== `v${toolchain.tools.node.version}`) {
    throw new Error(`expected locked Node v${toolchain.tools.node.version}, found ${nodeVersion}`);
  }
  return { genes, upstreamGenes, actualCommit, actualTree, statusLines, env, nodeVersion };
}

function runFullCi(state) {
  const result = spawnSync("yarn", ["test:ci"], {
    cwd: GENES_REPO,
    env: state.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120,
    timeout: 20 * 60 * 1000
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`genes-ts full CI failed with exit ${result.status}:\n${output.slice(-12000)}`);
  }
  const requiredMarkers = [
    "No issues found",
    "OK: version=1.13.0",
    "288 Assertions   288 Success   0 Failure   0 Error",
    "Snapshots OK (47 files)",
    "Roundtrip OK (3 fixtures)",
    "3 passed"
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !output.includes(marker));
  if (missingMarkers.length > 0) throw new Error(`genes-ts full CI output is missing markers: ${missingMarkers.join(", ")}`);
  return {
    command: "yarn test:ci",
    exit_code: result.status,
    output_sha256: sha256(output),
    output_bytes: Buffer.byteLength(output),
    required_markers: requiredMarkers,
    stages: [
      "secret scan",
      "OSV vulnerability scan",
      "version consistency",
      "classic Genes JavaScript compile and Node runtime assertions",
      "genes-ts TypeScript standard/minimal/full/TSX output",
      "TypeScript source-map and snapshot checks",
      "todoapp API and Playwright runtime smoke",
      "ts2hx snapshots and roundtrips"
    ]
  };
}

function main() {
  const state = lockedState();
  let manifest;
  if (checkOnly) {
    if (!existsSync(MANIFEST)) throw new Error(`${MANIFEST} is missing; run without --check`);
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } else {
    const fullCi = runFullCi(state);
    manifest = {
      schema: "wphx.genes-ts-output-modes.v1",
      issue: ISSUE.external_ref,
      recorded_at: RECORDED_AT,
      compiler: {
        repo: "../genes",
        commit: state.actualCommit,
        tree: state.actualTree,
        describe: state.genes.describe,
        declared_version: state.genes.declared_version,
        package_manager: state.genes.package_manager,
        typescript: state.genes.typescript,
        observed_status: state.statusLines
      },
      runtime: {
        node: state.nodeVersion,
        node_pin: state.genes ? JSON.parse(readFileSync(TOOLCHAIN_LOCK, "utf8")).tools.node.version : null
      },
      output_modes: [
        {
          id: "classic_genes_js",
          selector: "omit -D genes.ts",
          output: "split ESM JavaScript with optional declarations",
          validation: "classic compiler build plus 288/288 Node runtime assertions"
        },
        {
          id: "genes_ts_typescript",
          selector: "-D genes.ts",
          output: "split TypeScript/TSX source",
          validation: "standard/minimal/full/TSX builds, strict typechecks, snapshots, source maps, runtime and Playwright smoke"
        }
      ],
      full_ci: fullCi,
      validation_result: {
        status: "passed",
        both_output_modes_green: true,
        deterministic_snapshots_green: true,
        runtime_smoke_green: true,
        security_gate_green: true,
        compiler_change_required_by_wordpresshx: false
      }
    };
    writeJson(MANIFEST, manifest);
  }

  if (manifest.compiler.commit !== state.actualCommit) throw new Error("output-mode manifest compiler commit is stale");
  if (manifest.runtime.node !== state.nodeVersion) throw new Error("output-mode manifest Node version is stale");
  if (manifest.validation_result?.status !== "passed") throw new Error("output-mode manifest does not record a passed gate");

  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-401-genes-ts-output-modes",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    generator: RUNNER,
    command: "locked genes-ts full CI across classic JavaScript and TypeScript output modes",
    evidence_class: "compiler_platform_full_ci",
    artifact_scope: "locked_sibling_compiler_checkout",
    artifacts: [
      inputRecord(TOOLCHAIN_LOCK, "toolchain and genes-ts compiler pin"),
      inputRecord(UPSTREAM_LOCK, "sibling checkout authority and dirty-state record"),
      inputRecord(MANIFEST, "both-output-mode full CI result")
    ],
    verification_commands: [
      "npm run genes-ts:output-modes",
      "npm run genes-ts:output-modes:check",
      "yarn test:ci (in ../genes at the pinned commit with locked Node 20.19.3)"
    ],
    validation_result: manifest.validation_result,
    compiler: manifest.compiler,
    runtime: manifest.runtime,
    output_modes: manifest.output_modes,
    full_ci: manifest.full_ci,
    non_claims: [
      "WPHX-401 proves the pinned compiler platform and its two output modes, not a WordPress or Gutenberg package port.",
      "The F8 leaf-package and F9 React/TSX feasibility spikes remain WPHX-403 and WPHX-404.",
      "No WordPress-specific compiler change was added to genes-ts.",
      "Browser, Gutenberg, classic-script, installed-distribution, and release parity remain open."
    ]
  };
  const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
  writeOrCheck(RECEIPT, receiptText);
  return receipt;
}

try {
  const receipt = main();
  console.log(
    JSON.stringify(
      {
        status: "passed",
        check: checkOnly,
        output: RECEIPT,
        compiler_commit: receipt.compiler.commit,
        node: receipt.runtime.node,
        output_modes: receipt.output_modes.map((mode) => mode.id)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
