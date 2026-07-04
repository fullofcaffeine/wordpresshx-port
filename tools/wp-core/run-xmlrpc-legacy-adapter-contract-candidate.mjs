#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-hoin",
  external_ref: "WPHX-318.02",
  title: "WPHX-318.02 - Add XML-RPC legacy adapter contract candidate"
};
const RECORDED_AT = "2026-07-04T11:20:00.000Z";
const HXML = "fixtures/wp-core/xmlrpc-legacy-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-318-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const OUT = "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-xmlrpc-legacy-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/xmlrpc/XmlRpcLegacyAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/XmlRpcLegacyAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "endpoint:disabled": "xmlrpc_endpoint_disabled",
  "endpoint:get": "xmlrpc_endpoint_reject_non_post",
  "endpoint:missing-body": "xmlrpc_endpoint_missing_body",
  "endpoint:dispatch": "xmlrpc_endpoint_dispatch",
  "method:system": "xmlrpc_method_system",
  "method:demo": "xmlrpc_method_demo",
  "method:wp": "xmlrpc_method_wordpress",
  "method:blogger": "xmlrpc_method_blogger",
  "method:mw": "xmlrpc_method_meta_weblog",
  "method:mt": "xmlrpc_method_movable_type",
  "method:pingback": "xmlrpc_method_pingback",
  "method:unknown": "xmlrpc_method_unknown",
  "guard:public": "xmlrpc_guard_public_method",
  "guard:min-args": "xmlrpc_guard_minimum_args_failed",
  "guard:missing-credentials": "xmlrpc_guard_credentials_missing",
  "guard:auth-failed": "xmlrpc_guard_auth_failed",
  "guard:content-cap": "xmlrpc_guard_content_capability_denied",
  "guard:media-cap": "xmlrpc_guard_media_capability_denied",
  "guard:options-cap": "xmlrpc_guard_options_capability_denied",
  "guard:ready": "xmlrpc_guard_ready",
  "ixr:missing-xml": "xmlrpc_ixr_missing_xml",
  "ixr:parse-fault": "xmlrpc_ixr_parse_fault",
  "ixr:missing-method": "xmlrpc_ixr_missing_method",
  "ixr:method-call": "xmlrpc_ixr_method_call",
  "ixr:fault-response": "xmlrpc_ixr_fault_response",
  "ixr:success-response": "xmlrpc_ixr_success_response",
  "deprecated:function": "xmlrpc_deprecated_function",
  "deprecated:file": "xmlrpc_deprecated_file",
  "deprecated:legacy-compat": "xmlrpc_legacy_compat_function",
  "deprecated:unknown": "xmlrpc_deprecated_unknown",
  "boundary:entrypoint": "xmlrpc_boundary_entrypoint",
  "boundary:server": "xmlrpc_boundary_server",
  "boundary:deprecated": "xmlrpc_boundary_deprecated_api",
  "boundary:ixr": "xmlrpc_boundary_ixr_library",
  "boundary:akismet": "xmlrpc_boundary_akismet",
  "boundary:hello": "xmlrpc_boundary_hello",
  "boundary:plugin-guard": "xmlrpc_boundary_plugin_guard",
  "boundary:unknown": "xmlrpc_boundary_unknown",
  "handoff:auth": "xmlrpc_handoff_auth_users",
  "handoff:posts": "xmlrpc_handoff_posts_query",
  "handoff:taxonomy-comments": "xmlrpc_handoff_taxonomy_comments",
  "handoff:media": "xmlrpc_handoff_media_upload",
  "handoff:http-pingback": "xmlrpc_handoff_http_pingback",
  "handoff:multisite": "xmlrpc_handoff_multisite",
  "handoff:deprecated": "xmlrpc_handoff_deprecated_api",
  "handoff:unknown": "xmlrpc_handoff_unknown"
};

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
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

function stableGeneratedContents(data) {
  return data.toString("utf8").replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
}

function filesUnder(root) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      if (entry.isFile()) {
        const stableContents = stableGeneratedContents(readFileSync(child));
        files.push({
          path: relative(root, child),
          bytes: Buffer.byteLength(stableContents),
          sha256: createHash("sha256").update(stableContents).digest("hex")
        });
      }
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source),
    contains_raw_javascript: /\bjs\.Syntax\b/.test(source)
  };
}

function parseOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Unexpected output line: ${line}`);
    result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

function generatedPhpLintRecords(paths) {
  return paths
    .filter((record) => record.path.endsWith(".php"))
    .map((record) => ({
      path: `${HAXE_OUT}/${record.path}`,
      relative_path: record.path,
      sha256: `sha256:${record.sha256}`,
      php_lint: command("php", ["-l", `${HAXE_OUT}/${record.path}`])
    }));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/xmlrpc-legacy-adapter-contract-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_adapter_contract",
      name: "XML-RPC, legacy, deprecated API endpoint, guard, IXR handoff, boundary, and cross-domain decisions",
      area:
        "xmlrpc.php wp-includes/class-wp-xmlrpc-server.php wp-includes/class-IXR.php wp-includes/deprecated.php wp-content/plugins/hello.php wp-content/plugins/akismet/* wp-includes/IXR/*",
      public_contract:
        "Haxe owns a typed WPHX-318 adapter-contract decision model. Public xmlrpc.php replacement, wp_xmlrpc_server behavior, IXR request/response serialization, deprecated API behavior parity, bundled plugin implementation ownership, database-backed installed behavior, and generated original-path adapter ownership are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_adapter_contract"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Install these decisions through typed Adapter IR/original-path generation and pass xmlrpc.php endpoint/bootstrap, wp_xmlrpc_server method registry/auth/fault, IXR request/response serialization, deprecated API behavior, bundled plugin provenance, selected upstream PHPUnit, installed HTTP route, database-backed, and generated-overlay gates before claiming public PHP ABI ownership or XML-RPC/deprecated API parity."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate",
        "npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-318-02-xmlrpc-legacy-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate with module-level Haxe functions and typed enums. It adds no handwritten production PHP shell and no public WordPress file replacement."
  };
}

const lock = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);

const generatedFiles = filesUnder(HAXE_OUT);
const output = command("php", [ENTRY]);
const observations = parseOutput(output);
const matchesExpected = JSON.stringify(observations) === JSON.stringify(EXPECTED);
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);

if (!matchesExpected || !sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", matchesExpected, observations, haxeSourceAudits }, null, 2));
  process.exit(1);
}

const generatedPhpLint = generatedPhpLintRecords(generatedFiles);
const manifest = {
  schema: "wphx.wp-core-xmlrpc-legacy-adapter-contract-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "generated_shape"],
  artifact_scope: "helper",
  inputs: {
    prior_manifest: inputRecord(PRIOR_MANIFEST),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  fixture: {
    candidate_kind: "haxe_xmlrpc_legacy_adapter_contract_candidate",
    promoted_contracts: [
      "XML-RPC endpoint admission intent for disabled endpoints, non-POST requests, missing request bodies, and dispatch-ready requests",
      "XML-RPC method-family classification for system, demo, WordPress, Blogger, MetaWeblog, MovableType, pingback, and unknown method namespaces",
      "auth/capability guard intent for public methods, minimum argument failures, missing credentials, failed authentication, content/media/options capability denial, and ready state",
      "IXR envelope handoff intent for missing XML, parse faults, missing method names, pending method calls, fault responses, and success responses",
      "legacy/deprecated symbol classification for deprecated functions/files, legacy compatibility symbols, and unknown symbols",
      "boundary classification for xmlrpc.php, wp_xmlrpc_server, deprecated.php, preserved IXR library files, bundled Akismet artifacts, Hello Dolly, plugin directory guards, and unknown files",
      "cross-domain handoff intent for auth/users, posts/query, taxonomy/comments, media upload, pingback/HTTP, multisite, deprecated APIs, and unknown method domains"
    ],
    observations,
    expected: EXPECTED,
    observation_count: Object.keys(observations).length,
    generated_files: generatedFiles,
    generated_php_lint: generatedPhpLint,
    haxe_source_escape_audit: haxeSourceAudits,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    toolchain: {
      haxe: command("haxe", ["--version"]),
      php: command("php", ["-r", "echo PHP_VERSION;"]),
      toolchain_lock_sha256: inputRecord("toolchain.lock.json").sha256,
      haxe_version_pinned: lock.haxe?.version ?? null
    }
  },
  claims: {
    semantic_parity_claimed: false,
    targeted_adapter_contract_claimed: true,
    public_php_replacement_claimed: false,
    xmlrpc_runtime_behavior_claimed: false,
    xmlrpc_request_response_parity_claimed: false,
    deprecated_api_behavior_parity_claimed: false,
    installed_route_execution_claimed: false,
    database_backed_state_claimed: false,
    upstream_phpunit_pass_pass_claimed: false,
    bundled_plugin_implementation_ownership_claimed: false,
    ixr_library_implementation_ownership_claimed: false,
    generated_original_path_adapter_claimed: false
  },
  non_claims: [
    "Does not replace xmlrpc.php, wp-includes/class-wp-xmlrpc-server.php, wp-includes/class-IXR.php, wp-includes/deprecated.php, bundled plugin files, or preserved IXR library files.",
    "Does not execute WordPress bootstrap, wp_xmlrpc_server method handlers, IXR XML parsing/serialization, user/session/capability APIs, post/comment/term/media/database behavior, pingback HTTP behavior, deprecation hooks, or installed XML-RPC HTTP routes.",
    "Does not claim XML-RPC request/response parity, deprecated API behavior parity, upstream PHPUnit pass/pass, Akismet/Hello Dolly implementation ownership, IXR implementation ownership, public PHP ABI replacement, or durable original-path adapter ownership."
  ],
  validation_result: {
    status: "passed",
    matches_expected: matchesExpected,
    observation_count: Object.keys(observations).length,
    generated_file_count: generatedFiles.length,
    generated_php_lint_count: generatedPhpLint.length,
    source_escape_audit_passed: sourceEscapeAuditPassed
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-318-02-xmlrpc-legacy-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "XML-RPC legacy adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "XML-RPC legacy adapter-contract candidate ownership manifest" },
    { path: RUNNER, role: "deterministic Haxe candidate generator/check runner" },
    { path: "src/wphx/wp/xmlrpc/XmlRpcLegacyAdapterContract.hx", role: "typed Haxe adapter-contract source" },
    { path: "fixtures/wp-core/src/wphx/fixtures/wp/core/XmlRpcLegacyAdapterContractCandidateEntry.hx", role: "executable stock-Haxe PHP probe" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate",
    "npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: ["receipt:wphx-318-01-xmlrpc-legacy-deprecated-surface"]
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(manifest.validation_result, null, 2));
