#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const checkOnly = process.argv.includes("--check");
const OUT = "manifests/wphx-php/adapter-raw-block-policy.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-adapter-raw-block-policy.v1.json";
const RECORDED_AT = "2026-06-30T00:00:00Z";
const PROFILE = "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx";
const TEMPLATE_DIR = "src/wphx/compiler/php/templates/wordpress";
const ISSUE = {
  id: "wordpresshx-msp",
  external_ref: "WPHX-COMP-PHP-ADAPTER-RAW-BLOCK-GUARD",
  title: "Guard WordPress adapter raw blocks"
};

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return path.endsWith(".php.template") ? [path] : [];
  });
}

function rawBlockOccurrences() {
  const lines = readFileSync(PROFILE, "utf8").split("\n");
  const occurrences = [];
  for (const [index, line] of lines.entries()) {
    if (!line.includes("PhpRawBlock(")) continue;
    const allowed = /\bPhpRawBlock\s*\(\s*rendered\.code\s*\)/.test(line);
    occurrences.push({
      path: PROFILE,
      line: index + 1,
      source: line.trim(),
      source_sha256: sha256(line.trim()),
      allowed,
      policy: allowed ? "rendered-template-body" : "inline-raw-php-body"
    });
  }
  return occurrences;
}

function templateRecords() {
  return walk(TEMPLATE_DIR)
    .sort()
    .map((path) => ({
      path,
      bytes: statSync(path).size,
      sha256: sha256File(path)
    }));
}

const occurrences = rawBlockOccurrences();
const violations = occurrences.filter((occurrence) => !occurrence.allowed);
if (violations.length > 0) {
  console.error(JSON.stringify({ status: "failed", violations }, null, 2));
  process.exit(1);
}

const templates = templateRecords();
const manifest = {
  schema: "wphx.wphx-php-adapter-raw-block-policy.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wphx-php/check-adapter-raw-blocks.mjs",
  scanned_profile: {
    path: PROFILE,
    bytes: statSync(PROFILE).size,
    sha256: sha256File(PROFILE)
  },
  template_directory: TEMPLATE_DIR,
  templates,
  php_raw_block_count: occurrences.length,
  inline_raw_block_count: violations.length,
  occurrences,
  policy: {
    allowed_raw_block_argument: "rendered.code",
    requirement:
      "WordPress-profile public adapter PHP bodies must be structured IR or compiler-owned templates with manifest provenance; inline PhpRawBlock string bodies are forbidden."
  },
  validation_result: {
    status: "passed",
    only_rendered_template_raw_blocks: true,
    inline_raw_blocks_forbidden: true,
    template_count: templates.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const receipt = {
  schema: "wphx.compiler-core-driver-receipt.v1",
  id: "receipt:wphx-comp-php-adapter-raw-block-policy",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  status: "passed",
  evidence_class: "compiler_policy_guard",
  artifact_scope: "wordpress_profile_php_raw_block_policy",
  commands: [
    "npm run wphx:php:adapter-raw-blocks",
    "npm run wphx:php:adapter-raw-blocks:check",
    "npm run precommit"
  ],
  artifacts: [
    {
      path: "tools/wphx-php/check-adapter-raw-blocks.mjs",
      role: "policy guard for WordPress-profile PhpRawBlock usage"
    },
    {
      path: PROFILE,
      role: "WordPress-profile adapter source scanned by the guard"
    },
    {
      path: OUT,
      role: "manifest recording allowed rendered-template raw block occurrences"
    }
  ],
  validation_result: manifest.validation_result,
  claims: [
    "The WordPress adapter profile no longer permits inline PhpRawBlock PHP string bodies.",
    "The only allowed PhpRawBlock form in WphxPhpWordPressAdapters.hx is PhpRawBlock(rendered.code), which points back to compiler-owned adapter template provenance.",
    "The policy guard is wired into npm precommit checks."
  ],
  non_claims: [
    "This does not claim that all adapter templates have been promoted to structured PHP IR.",
    "This does not claim WPHX PHP is a complete arbitrary-Haxe PHP backend.",
    "This does not claim additional WordPress runtime behavior parity."
  ]
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (checkOnly) {
  for (const [path, text] of [
    [OUT, manifestText],
    [RECEIPT, receiptText]
  ]) {
    if (!existsSync(path)) {
      console.error(JSON.stringify({ status: "failed", error: `${path} does not exist` }, null, 2));
      process.exit(1);
    }
    if (readFileSync(path, "utf8") !== text) {
      console.error(JSON.stringify({ status: "failed", error: `${path} is stale` }, null, 2));
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, php_raw_block_count: occurrences.length }, null, 2));
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(dirname(RECEIPT), { recursive: true });
writeFileSync(OUT, manifestText);
writeFileSync(RECEIPT, receiptText);
console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, php_raw_block_count: occurrences.length }, null, 2));
