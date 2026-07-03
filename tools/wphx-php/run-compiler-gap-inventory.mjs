#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const RECORDED_AT = "2026-07-03T06:00:00Z";
const RUNNER = "tools/wphx-php/run-compiler-gap-inventory.mjs";
const MANIFEST = "manifests/wphx-php/compiler-gap-inventory.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-gap-inventory.v1.json";
const COMPILER = "src/wphx/compiler/php/WphxPhpCompiler.hx";
const WORDPRESS_PROFILE = "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx";
const FIXTURE_SOURCE_ROOT = "fixtures/wphx-php/src";
const FIXTURE_HXML_ROOT = "fixtures/wphx-php";
const WPHX_MANIFEST_ROOT = "manifests/wphx-php";
const PROFILE_CORE_AUDIT_MANIFEST = "manifests/wphx-php/profile-core-promotion-audit.v1.json";
const ISSUE = {
  id: "wordpresshx-w91.24.1",
  external_ref: "WPHX-COMP-PHP-GAP-INVENTORY",
  title: "Audit stock PHP target dependencies and WPHX PHP gaps"
};

const STOCK_HAXE_REFERENCES = [
  {
    path: "../haxe.compilerdev.reference/haxe/src/generators/genphp7.ml",
    role: "stock Haxe PHP generator implementation oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/Boot.hx",
    role: "stock Haxe PHP runtime boot oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/NativeArray.hx",
    role: "stock native PHP array behavior oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/NativeAssocArray.hx",
    role: "stock native PHP associative-array behavior oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/Lib.hx",
    role: "stock PHP library helper oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/Syntax.hx",
    role: "stock PHP syntax escape hatch oracle"
  },
  {
    path: "../haxe.compilerdev.reference/haxe/std/php/Global.hx",
    role: "stock PHP global function extern oracle"
  }
];

function normalizePath(path) {
  return path.split("\\").join("/");
}

function sha256Bytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Text(value) {
  return sha256Bytes(value);
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function inputRecord(path) {
  return {
    path: normalizePath(path),
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function walk(dir, predicate = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = normalizePath(join(dir, entry.name));
      if (entry.isDirectory()) return walk(path, predicate);
      return predicate(path) ? [path] : [];
    })
    .sort();
}

function readLines(path) {
  return readFileSync(path, "utf8").split("\n");
}

function lineNumberForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function hxmlValue(lines, index, flag) {
  const line = lines[index].trim();
  if (line === flag) return lines[index + 1]?.trim() ?? null;
  if (line.startsWith(`${flag} `)) return line.slice(flag.length + 1).trim();
  return null;
}

function parseDefine(value) {
  const separator = value.indexOf("=");
  if (separator === -1) return { name: value, value: true };
  return {
    name: value.slice(0, separator),
    value: value.slice(separator + 1)
  };
}

function parseHxml(path) {
  const lines = readLines(path);
  const activeLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
  const classpaths = [];
  const defines = {};
  let main = null;
  let stockOutput = null;
  let compilerMacro = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const classpath = hxmlValue(lines, index, "-cp");
    if (classpath !== null) {
      classpaths.push(classpath);
      continue;
    }

    const mainValue = hxmlValue(lines, index, "-main");
    if (mainValue !== null) {
      main = mainValue;
      continue;
    }

    const phpValue = hxmlValue(lines, index, "-php");
    if (phpValue !== null) {
      stockOutput = phpValue;
      continue;
    }

    const defineValue = hxmlValue(lines, index, "-D");
    if (defineValue !== null) {
      const parsed = parseDefine(defineValue);
      defines[parsed.name] = parsed.value;
      continue;
    }

    if (line.includes("wphx.compiler.php.CompilerInit.Start()")) {
      compilerMacro = true;
    }
  }

  const usesWphxPhp = compilerMacro || typeof defines.wphx_php_output === "string";
  return {
    path,
    main,
    role: stockOutput !== null ? "stock_haxe_php_private_output" : usesWphxPhp ? "wphx_php_public_adapter_output" : "other",
    active_line_count: activeLines.length,
    classpaths: classpaths.sort(),
    uses_reflaxe_classpath: classpaths.some((classpath) => classpath.includes("reflaxe/src")),
    compiler_macro: compilerMacro,
    stock_php_output: stockOutput,
    wphx_php_output: typeof defines.wphx_php_output === "string" ? defines.wphx_php_output : null,
    wphx_php_manifest: typeof defines.wphx_php_manifest === "string" ? defines.wphx_php_manifest : null,
    wphx_php_profile: typeof defines.wphx_php_profile === "string" ? defines.wphx_php_profile : null,
    haxe_php_profile: typeof defines["wphx-profile"] === "string" ? defines["wphx-profile"] : null,
    defines: Object.keys(defines)
      .sort()
      .map((name) => ({ name, value: defines[name] }))
  };
}

function quotedArgs(raw) {
  const args = [];
  const stringLiteral = /"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = stringLiteral.exec(raw)) !== null) {
    args.push(match[1]);
  }
  return args;
}

function sourceOccurrences(files, kind, regex, details) {
  const occurrences = [];
  for (const path of files) {
    const source = readFileSync(path, "utf8");
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      occurrences.push({
        kind,
        path,
        line: lineNumberForOffset(source, match.index),
        ...details(match)
      });
    }
  }
  return occurrences.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function metadataInventory(files) {
  const adapter = sourceOccurrences(files, "wp.adapter", /@:wp\.adapter\("([^"]+)"\)/g, (match) => ({
    adapter: match[1]
  }));
  const haxeHelper = sourceOccurrences(files, "wp.haxeHelper", /@:wp\.haxeHelper\(([^)]*)\)/g, (match) => {
    const args = quotedArgs(match[1]);
    return {
      raw_argument: match[1].trim(),
      alias: args.length === 2 ? args[0] : "primary",
      helper_class: args.length === 1 ? args[0] : args.length === 2 ? args[1] : null,
      argument_count: args.length
    };
  });
  const haxeBootstrap = sourceOccurrences(files, "wp.haxeBootstrap", /@:wp\.haxeBootstrap\("([^"]+)"\)/g, (match) => ({
    bootstrap_constant: match[1]
  }));
  const scriptAdapter = sourceOccurrences(files, "wp.scriptAdapter", /@:wp\.scriptAdapter\("([^"]+)"\)/g, (match) => ({
    adapter: match[1]
  }));
  const file = sourceOccurrences(files, "wp.file", /@:wp\.file\("([^"]+)"\)/g, (match) => ({
    output_path: match[1]
  }));
  const native = sourceOccurrences(files, "native", /@:native\("([^"]+)"\)/g, (match) => ({
    native_name: match[1]
  }));

  return {
    wp_adapter: adapter,
    wp_haxe_helper: haxeHelper,
    wp_haxe_bootstrap: haxeBootstrap,
    wp_script_adapter: scriptAdapter,
    wp_file: file,
    native
  };
}

function methodAdapterRegistry() {
  const source = readFileSync(WORDPRESS_PROFILE, "utf8");
  const start = source.indexOf("public static function methodBody");
  const end = source.indexOf("case _:", start);
  const slice = start === -1 || end === -1 ? "" : source.slice(start, end);
  const entries = [];
  const adapterCase = /case "([^"]+)":/g;
  let match;
  while ((match = adapterCase.exec(slice)) !== null) {
    entries.push({
      adapter: match[1],
      path: WORDPRESS_PROFILE,
      line: lineNumberForOffset(source, start + match.index)
    });
  }
  return entries.sort((left, right) => left.adapter.localeCompare(right.adapter));
}

function scriptAdapterRegistry() {
  const source = readFileSync(COMPILER, "utf8");
  const start = source.indexOf("function emitScript");
  const end = source.indexOf("function emitIncludeSideEffectsScript", start);
  const slice = start === -1 || end === -1 ? "" : source.slice(start, end);
  const entries = [];
  const adapterCase = /case "([^"]+)":/g;
  let match;
  while ((match = adapterCase.exec(slice)) !== null) {
    entries.push({
      adapter: match[1],
      path: COMPILER,
      line: lineNumberForOffset(source, start + match.index)
    });
  }
  return entries.sort((left, right) => left.adapter.localeCompare(right.adapter));
}

function rawTemplateDebt() {
  const source = readFileSync(WORDPRESS_PROFILE, "utf8");
  const lines = source.split("\n");
  const rawBlocks = [];
  const renderTemplates = [];
  for (const [index, line] of lines.entries()) {
    if (line.includes("PhpRawBlock(")) {
      rawBlocks.push({
        path: WORDPRESS_PROFILE,
        line: index + 1,
        source_sha256: sha256Text(line.trim())
      });
    }
    if (line.includes("renderTemplate(") && !line.includes("function renderTemplate")) {
      renderTemplates.push({
        path: WORDPRESS_PROFILE,
        line: index + 1,
        source_sha256: sha256Text(line.trim())
      });
    }
  }
  return {
    php_raw_blocks: rawBlocks,
    render_template_calls: renderTemplates,
    php_raw_block_count: rawBlocks.length,
    render_template_call_count: renderTemplates.length
  };
}

function unsupportedReportSites() {
  const source = readFileSync(COMPILER, "utf8");
  const lines = source.split("\n");
  return lines
    .flatMap((line, index) => {
      if (!line.includes("reportUnsupported(")) return [];
      return [
        {
          path: COMPILER,
          line: index + 1,
          source: line.trim(),
          source_sha256: sha256Text(line.trim()),
          pressure: unsupportedPressure(line)
        }
      ];
    })
    .sort((left, right) => left.line - right.line);
}

function unsupportedPressure(line) {
  if (line.includes("unsupported expression")) return "typed_expression_lowering";
  if (line.includes("unsupported binary operator")) return "typed_binary_operator_lowering";
  if (line.includes("unsupported field access")) return "typed_field_lowering";
  if (line.includes("unsupported visibility")) return "public_abi_metadata";
  if (line.includes("missing @:wp.file")) return "public_file_metadata";
  if (line.includes("@:wp.haxeHelper")) return "helper_bridge_metadata";
  return "compiler_validation";
}

function manifestSummary(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const validation = parsed.validation_result ?? {};
  const unsupportedEmpty =
    typeof validation.unsupported_empty === "boolean"
      ? validation.unsupported_empty
      : Array.isArray(parsed.unsupported)
        ? parsed.unsupported.length === 0
        : null;
  return {
    path,
    schema: parsed.schema ?? null,
    issue: typeof parsed.issue === "string" ? parsed.issue : parsed.issue?.external_ref ?? null,
    status: validation.status ?? parsed.status ?? null,
    unsupported_empty: unsupportedEmpty,
    core_ir_feature_count: Array.isArray(parsed.core_ir_features) ? parsed.core_ir_features.length : null,
    segment_plan_count: Array.isArray(parsed.segment_plans) ? parsed.segment_plans.length : null,
    adapter_template_count: Array.isArray(parsed.adapter_templates) ? parsed.adapter_templates.length : null,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function packageWphxRunnerPaths() {
  const parsed = JSON.parse(readFileSync("package.json", "utf8"));
  const runners = [];
  for (const [scriptName, command] of Object.entries(parsed.scripts ?? {})) {
    if (!scriptName.startsWith("wphx:php:") || scriptName.endsWith(":check")) continue;
    const match = command.match(/node\s+([^\s]+\.mjs)/);
    if (!match) continue;
    runners.push({
      script: scriptName,
      path: normalizePath(match[1])
    });
  }
  return runners.sort((left, right) => left.script.localeCompare(right.script));
}

function runnerSurfaceScan(runner) {
  const source = readFileSync(runner.path, "utf8");
  const lines = source.split("\n");
  const lineHits = [];
  const patterns = [
    ["copy_file", "copyFileSync("],
    ["copy_tree", "cpSync("],
    ["source_replace_patch", "source.replace("],
    ["transformed_write", "const transformed"],
    ["runner_patch_word", "runner-patched"],
    ["copied_word", "copied"]
  ];
  for (const [index, line] of lines.entries()) {
    for (const [kind, token] of patterns) {
      if (!line.includes(token)) continue;
      lineHits.push({
        kind,
        line: index + 1,
        source_sha256: sha256Text(line.trim())
      });
    }
  }
  return {
    ...runner,
    uses_copy_file_sync: source.includes("copyFileSync("),
    uses_upstream_oracle_copy: source.includes("copyFileSync(upstreamPath("),
    uses_generated_shell_install_copy: source.includes("copyFileSync(source, target)") || source.includes("copyFileSync(generated, target)"),
    uses_source_replace_patch: source.includes("source.replace("),
    copied_or_patch_line_count: lineHits.length,
    copied_or_patch_lines: lineHits
  };
}

function referenceRecord(reference) {
  return {
    ...reference,
    exists: existsSync(reference.path),
    bytes: existsSync(reference.path) ? statSync(reference.path).size : null,
    sha256: existsSync(reference.path) ? sha256File(reference.path) : null
  };
}

function countBy(records, key) {
  const counts = {};
  for (const record of records) {
    const value = record[key] ?? "(none)";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.keys(counts)
    .sort()
    .map((value) => ({ value, count: counts[value] }));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function gapClassification({
  hxmls,
  metadata,
  methodRegistry,
  scriptRegistry,
  rawDebt,
  unsupportedSites,
  runnerSurfaces,
  references,
  profileCoreAudit
}) {
  const stockHxmls = hxmls.filter((record) => record.stock_php_output !== null);
  const wphxHxmls = hxmls.filter((record) => record.wphx_php_output !== null);
  const copiedSurfaces = runnerSurfaces.filter(
    (record) => record.uses_upstream_oracle_copy || record.uses_source_replace_patch || record.uses_generated_shell_install_copy
  );
  const missingReferences = references.filter((record) => !record.exists);

  return [
    {
      id: "stock_haxe_php_private_outputs",
      classification: "std_php_runtime_to_borrow",
      severity: stockHxmls.length > 0 ? "active_dependency" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-RUNTIME-STDLIB-STRATEGY",
      count: stockHxmls.length,
      paths: stockHxmls.map((record) => record.path),
      note: "Stock Haxe PHP remains the private implementation/runtime oracle until WPHX PHP has an accepted runtime/std strategy."
    },
    {
      id: "wphx_reflaxe_public_adapter_outputs",
      classification: "current_custom_compiler_lane",
      severity: wphxHxmls.length > 0 ? "active_lane" : "missing",
      follow_up_owner: "WPHX-COMP-PHP-ADOPTION-CI",
      count: wphxHxmls.length,
      paths: wphxHxmls.map((record) => record.path),
      note: "These fixtures already use the Reflaxe-backed WPHX PHP compiler lane for original-path public output."
    },
    {
      id: "helper_bridge_metadata",
      classification: "temporary_fallback",
      severity: metadata.wp_haxe_helper.length > 0 ? "active_dependency" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-CORE-LOWERING-PILOT",
      count: metadata.wp_haxe_helper.length,
      helper_classes: unique(metadata.wp_haxe_helper.map((record) => record.helper_class).filter(Boolean)),
      note: "Helper metadata marks public-shell calls into stock-Haxe-emitted implementation classes; whole-file pilots should retire selected helper bridges."
    },
    {
      id: "bootstrap_bridge_metadata",
      classification: "std_php_runtime_to_borrow",
      severity: metadata.wp_haxe_bootstrap.length > 0 ? "active_dependency" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-RUNTIME-STDLIB-STRATEGY",
      count: metadata.wp_haxe_bootstrap.length,
      constants: unique(metadata.wp_haxe_bootstrap.map((record) => record.bootstrap_constant)),
      note: "Bootstrap constants protect stock-Haxe runtime loading behind WPHX public shells."
    },
    {
      id: "wordpress_profile_method_adapters",
      classification: "profile_accretion_gate",
      severity: methodRegistry.length > 0 ? "active_profile_scope" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-PROFILE-CORE-PROMOTION-AUDIT",
      count: methodRegistry.length,
      adapters: methodRegistry.map((record) => record.adapter),
      core_ir_candidate_count: profileCoreAudit?.summary?.core_ir_candidate_count ?? null,
      backend_promotion_pressure_count: profileCoreAudit?.summary?.backend_promotion_pressure_count ?? null,
      note: "Every current method adapter is classified by the profile/core promotion audit; generic constructs should migrate to reusable PHP core IR while WordPress ABI-only choices stay named in the profile."
    },
    {
      id: "script_adapter_switches",
      classification: "profile_accretion_gate",
      severity: scriptRegistry.length > 0 ? "active_profile_scope" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-PROFILE-CORE-PROMOTION-AUDIT",
      count: scriptRegistry.length,
      adapters: scriptRegistry.map((record) => record.adapter),
      temporary_bridge_count: profileCoreAudit?.summary?.temporary_bridge_count ?? null,
      note: "Every current script adapter is classified by the profile/core promotion audit; direct-script and template segment switches remain pressure for broader file/segment lowering before mixed-template ownership."
    },
    {
      id: "profile_core_promotion_audit",
      classification: "continuous_governance_gate",
      severity: profileCoreAudit?.validation_result?.status === "passed" ? "active_gate" : "missing_or_stale",
      follow_up_owner: "WPHX-COMP-PHP-CONTINUOUS-ADOPTION-CI",
      count: profileCoreAudit?.summary?.classified_adapter_count ?? 0,
      manifest: PROFILE_CORE_AUDIT_MANIFEST,
      classification_counts: profileCoreAudit?.validation_result?.classification_counts ?? [],
      note: "This amber-condition gate prevents WordPress-profile adapter growth from silently becoming a WordPress-only backend."
    },
    {
      id: "typed_lowering_unsupported_report_sites",
      classification: "reusable_php_core_ir",
      severity: unsupportedSites.length > 0 ? "backend_pressure" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-CORE-LOWERING-PILOT",
      count: unsupportedSites.length,
      pressures: countBy(unsupportedSites, "pressure"),
      note: "Unsupported-report sites define the next minimized arbitrary-Haxe lowering fixtures."
    },
    {
      id: "copied_or_runner_patched_surfaces",
      classification: "temporary_fallback",
      severity: copiedSurfaces.length > 0 ? "active_oracle_or_install_scaffolding" : "clear",
      follow_up_owner: "WPHX-COMP-PHP-ADOPTION-CI",
      count: copiedSurfaces.length,
      runners: copiedSurfaces.map((record) => record.path),
      note: "Current WPHX PHP runners may still copy oracle dependencies or install generated shells for candidate packages; source.replace patching is tracked separately."
    },
    {
      id: "stock_haxe_php_oracle_references",
      classification: "std_php_runtime_to_borrow",
      severity: missingReferences.length > 0 ? "blocked" : "available",
      follow_up_owner: "WPHX-COMP-PHP-RUNTIME-STDLIB-STRATEGY",
      count: references.length,
      missing: missingReferences.map((record) => record.path),
      note: "These local stock Haxe PHP references are available to reuse or adapt before reimplementing runtime/std behavior."
    },
    {
      id: "raw_block_template_debt",
      classification: "profile_escape_hatch_policy",
      severity: rawDebt.php_raw_block_count === 0 && rawDebt.render_template_call_count === 0 ? "clear" : "active_debt",
      follow_up_owner: "WPHX-COMP-PHP-ADAPTER-RAW-BLOCK-GUARD",
      count: rawDebt.php_raw_block_count + rawDebt.render_template_call_count,
      note: "The current WordPress profile has zero inline PhpRawBlock and zero renderTemplate calls; keep that guard green while promoting gaps."
    }
  ];
}

function validationResult({ hxmls, metadata, methodRegistry, scriptRegistry, rawDebt, manifests, references, classifications, profileCoreAudit }) {
  const wphxHxmls = hxmls.filter((record) => record.wphx_php_output !== null);
  const stockHxmls = hxmls.filter((record) => record.stock_php_output !== null);
  const missingReferences = references.filter((record) => !record.exists);
  const staleManifests = manifests.filter((record) => record.status !== null && record.status !== "passed");
  const failed = [];
  if (wphxHxmls.length === 0) failed.push("no WPHX PHP hxml fixtures found");
  if (stockHxmls.length === 0) failed.push("no stock Haxe PHP hxml dependencies found");
  if (!wphxHxmls.every((record) => record.uses_reflaxe_classpath)) failed.push("a WPHX PHP hxml is missing the Reflaxe classpath");
  if (metadata.wp_adapter.length === 0) failed.push("no @:wp.adapter metadata found");
  if (rawDebt.php_raw_block_count !== 0) failed.push("WordPress profile contains PhpRawBlock occurrences");
  if (rawDebt.render_template_call_count !== 0) failed.push("WordPress profile contains renderTemplate calls");
  if (missingReferences.length > 0) failed.push("stock Haxe PHP reference files are missing");
  if (staleManifests.length > 0) failed.push("a WPHX PHP evidence manifest reports non-passed status");
  if (profileCoreAudit === null) failed.push("profile/core promotion audit manifest is missing");
  if (profileCoreAudit !== null && profileCoreAudit.validation_result?.status !== "passed") {
    failed.push("profile/core promotion audit manifest is not passed");
  }
  if (profileCoreAudit !== null && profileCoreAudit.summary?.method_adapter_count !== methodRegistry.length) {
    failed.push("profile/core promotion audit method count no longer matches the profile adapter registry");
  }
  if (profileCoreAudit !== null && profileCoreAudit.summary?.script_adapter_count !== scriptRegistry.length) {
    failed.push("profile/core promotion audit script count no longer matches the script adapter registry");
  }
  if (profileCoreAudit !== null && profileCoreAudit.validation_result?.unclassified_count !== 0) {
    failed.push("profile/core promotion audit has unclassified adapters");
  }
  if (profileCoreAudit !== null && profileCoreAudit.validation_result?.stale_classification_count !== 0) {
    failed.push("profile/core promotion audit has stale adapter classifications");
  }
  for (const id of [
    "stock_haxe_php_private_outputs",
    "helper_bridge_metadata",
    "wordpress_profile_method_adapters",
    "profile_core_promotion_audit",
    "typed_lowering_unsupported_report_sites",
    "stock_haxe_php_oracle_references"
  ]) {
    if (!classifications.some((classification) => classification.id === id)) {
      failed.push(`missing classification ${id}`);
    }
  }

  return {
    status: failed.length === 0 ? "passed" : "failed",
    failures: failed,
    wphx_hxml_count: wphxHxmls.length,
    stock_haxe_php_hxml_count: stockHxmls.length,
    reflaxe_backed_wphx_hxml_count: wphxHxmls.filter((record) => record.uses_reflaxe_classpath).length,
    wp_adapter_metadata_count: metadata.wp_adapter.length,
    wp_haxe_helper_metadata_count: metadata.wp_haxe_helper.length,
    wp_haxe_bootstrap_metadata_count: metadata.wp_haxe_bootstrap.length,
    wp_script_adapter_metadata_count: metadata.wp_script_adapter.length,
    php_raw_block_count: rawDebt.php_raw_block_count,
    render_template_call_count: rawDebt.render_template_call_count,
    manifest_count: manifests.length,
    manifest_statuses_passed: staleManifests.length === 0,
    profile_core_promotion_audit_passed: profileCoreAudit?.validation_result?.status === "passed",
    profile_core_promotion_unclassified_count: profileCoreAudit?.validation_result?.unclassified_count ?? null,
    profile_core_promotion_stale_classification_count: profileCoreAudit?.validation_result?.stale_classification_count ?? null,
    stock_haxe_reference_count: references.length,
    stock_haxe_reference_missing_count: missingReferences.length
  };
}

function buildInventory() {
  const hxmls = walk(FIXTURE_HXML_ROOT, (path) => path.endsWith(".hxml") && dirname(path) === FIXTURE_HXML_ROOT).map(parseHxml);
  const fixtureSources = walk(FIXTURE_SOURCE_ROOT, (path) => path.endsWith(".hx"));
  const metadata = metadataInventory(fixtureSources);
  const methodRegistry = methodAdapterRegistry();
  const scriptRegistry = scriptAdapterRegistry();
  const profileCoreAudit = readJsonIfExists(PROFILE_CORE_AUDIT_MANIFEST);
  const rawDebt = rawTemplateDebt();
  const unsupportedSites = unsupportedReportSites();
  const manifests = walk(WPHX_MANIFEST_ROOT, (path) => path.endsWith(".json") && path !== MANIFEST).map(manifestSummary);
  const runnerSurfaces = packageWphxRunnerPaths().map(runnerSurfaceScan);
  const references = STOCK_HAXE_REFERENCES.map(referenceRecord);
  const classifications = gapClassification({
    hxmls,
    metadata,
    methodRegistry,
    scriptRegistry,
    rawDebt,
    unsupportedSites,
    runnerSurfaces,
    references,
    profileCoreAudit
  });
  const validation = validationResult({
    hxmls,
    metadata,
    methodRegistry,
    scriptRegistry,
    rawDebt,
    manifests,
    references,
    classifications,
    profileCoreAudit
  });

  return {
    schema: "wphx.wphx-php-compiler-gap-inventory.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    scope: {
      hxml_root: FIXTURE_HXML_ROOT,
      fixture_source_root: FIXTURE_SOURCE_ROOT,
      compiler_core: COMPILER,
      wordpress_profile: WORDPRESS_PROFILE,
      evidence_manifest_root: WPHX_MANIFEST_ROOT
    },
    scanned_inputs: [
      inputRecord("package.json"),
      inputRecord(COMPILER),
      inputRecord(WORDPRESS_PROFILE),
      ...(profileCoreAudit === null ? [] : [inputRecord(PROFILE_CORE_AUDIT_MANIFEST)]),
      ...hxmls.map((record) => inputRecord(record.path)),
      ...fixtureSources.map(inputRecord)
    ].sort((left, right) => left.path.localeCompare(right.path)),
    summary: {
      hxml_count: hxmls.length,
      wphx_hxml_count: validation.wphx_hxml_count,
      stock_haxe_php_hxml_count: validation.stock_haxe_php_hxml_count,
      reflaxe_backed_wphx_hxml_count: validation.reflaxe_backed_wphx_hxml_count,
      wp_adapter_metadata_count: metadata.wp_adapter.length,
      wp_haxe_helper_metadata_count: metadata.wp_haxe_helper.length,
      wp_haxe_bootstrap_metadata_count: metadata.wp_haxe_bootstrap.length,
      wp_script_adapter_metadata_count: metadata.wp_script_adapter.length,
      method_adapter_registry_count: methodRegistry.length,
      script_adapter_registry_count: scriptRegistry.length,
      unsupported_report_site_count: unsupportedSites.length,
      runner_surface_count: runnerSurfaces.length,
      runner_surface_with_copy_or_patch_count: runnerSurfaces.filter(
        (record) => record.uses_upstream_oracle_copy || record.uses_source_replace_patch || record.uses_generated_shell_install_copy
      ).length,
      php_raw_block_count: rawDebt.php_raw_block_count,
      render_template_call_count: rawDebt.render_template_call_count,
      wphx_manifest_count: manifests.length,
      profile_core_promotion_audit_status: profileCoreAudit?.validation_result?.status ?? null,
      profile_core_promotion_core_ir_candidate_count: profileCoreAudit?.summary?.core_ir_candidate_count ?? null,
      profile_core_promotion_backend_pressure_count: profileCoreAudit?.summary?.backend_promotion_pressure_count ?? null,
      profile_core_promotion_temporary_bridge_count: profileCoreAudit?.summary?.temporary_bridge_count ?? null,
      stock_haxe_reference_missing_count: validation.stock_haxe_reference_missing_count
    },
    hxmls,
    source_metadata: metadata,
    wordpress_profile_method_adapter_registry: methodRegistry,
    compiler_script_adapter_registry: scriptRegistry,
    raw_template_debt: rawDebt,
    typed_lowering_unsupported_report_sites: unsupportedSites,
    wphx_php_evidence_manifests: manifests,
    wphx_php_runner_surfaces: runnerSurfaces,
    stock_haxe_php_references: references,
    gap_classification: classifications,
    validation_result: validation,
    non_claims: [
      "This inventory is static evidence; it does not prove new WordPress behavior parity.",
      "This does not claim WPHX PHP is already a mature arbitrary-Haxe reflaxe.php target.",
      "This does not retire stock Haxe PHP private implementation output, helper bridges, or bootstrap dependencies.",
      "This does not claim whole-file WP_Http, WP_HTTP_Response, mixed-template, or installed WordPress ownership."
    ]
  };
}

function buildReceipt(manifest, manifestText) {
  return {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-gap-inventory",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: manifest.validation_result.status,
    evidence_class: "compiler_gap_inventory",
    artifact_scope: "wphx_php_stock_target_and_backend_pressure_inventory",
    commands: ["npm run wphx:php:gap-inventory", "npm run wphx:php:gap-inventory:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic WPHX PHP compiler gap inventory runner"
      },
      {
        path: MANIFEST,
        role: "machine-readable stock-target dependency and WPHX PHP gap inventory"
      },
      {
        path: "docs/operations/wphx-php-compiler.md",
        role: "compiler operations documentation for the gap inventory lane"
      },
      {
        path: "docs/operations/progress-matrix.md",
        role: "durable program rollup updated for the compiler inventory checkpoint"
      }
    ],
    manifest_sha256: sha256Text(manifestText),
    validation_result: manifest.validation_result,
    claims: [
      "The inventory records current WPHX PHP hxmls, stock Haxe PHP private-output dependencies, Reflaxe-backed public adapter hxmls, helper/bootstrap metadata, WordPress profile adapters, script adapters, unsupported typed-lowering report sites, runner copy/patch surfaces, WPHX evidence manifests, and local stock Haxe PHP reference files.",
      "The current WordPress profile remains at zero PhpRawBlock occurrences and zero renderTemplate calls.",
      "Every current WPHX PHP public-adapter hxml uses the Reflaxe classpath and the WPHX CompilerInit macro.",
      "Follow-up ownership is classified across reusable PHP core IR, WordPress profile ABI constraints, std/php runtime borrowing, temporary fallbacks, backend pressure, and the executable profile/core promotion audit."
    ],
    non_claims: manifest.non_claims
  };
}

const inventory = buildInventory();
const manifestText = JSON.stringify(inventory, null, 2) + "\n";
const receipt = buildReceipt(inventory, manifestText);
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (inventory.validation_result.status !== "passed") {
  console.error(JSON.stringify(inventory.validation_result, null, 2));
  process.exit(1);
}

if (checkOnly) {
  for (const [path, text] of [
    [MANIFEST, manifestText],
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
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        wphx_hxml_count: inventory.validation_result.wphx_hxml_count,
        stock_haxe_php_hxml_count: inventory.validation_result.stock_haxe_php_hxml_count,
        method_adapter_registry_count: inventory.summary.method_adapter_registry_count,
        unsupported_report_site_count: inventory.summary.unsupported_report_site_count
      },
      null,
      2
    )
  );
  process.exit(0);
}

mkdirSync(dirname(MANIFEST), { recursive: true });
mkdirSync(dirname(RECEIPT), { recursive: true });
writeFileSync(MANIFEST, manifestText);
writeFileSync(RECEIPT, receiptText);
console.log(
  JSON.stringify(
    {
      status: "passed",
      output: MANIFEST,
      receipt: RECEIPT,
      wphx_hxml_count: inventory.validation_result.wphx_hxml_count,
      stock_haxe_php_hxml_count: inventory.validation_result.stock_haxe_php_hxml_count,
      method_adapter_registry_count: inventory.summary.method_adapter_registry_count,
      unsupported_report_site_count: inventory.summary.unsupported_report_site_count
    },
    null,
    2
  )
);
