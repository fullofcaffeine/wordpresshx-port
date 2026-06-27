#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.2",
  external_ref: "WPHX-312.02",
  title: "WPHX-312.02 - Add HTTP cron mail feed embed adapter-contract candidate"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const HXML = "fixtures/wp-core/http-cron-mail-feed-embed-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-312-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const OUT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-http-cron-mail-feed-embed-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/http/HttpCronMailFeedEmbedAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpCronMailFeedEmbedAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "http:preempt": "http_preempt",
  "http:blocked": "http_blocked",
  "http:curl": "http_curl",
  "http:streams": "http_streams",
  "http:error": "http_error",
  "cron:recurring": "cron_reschedule_recurring",
  "cron:due": "cron_run_due",
  "cron:locked": "cron_spawn_locked",
  "cron:spawn": "cron_spawn_request",
  "cron:noop": "cron_noop",
  "mail:short-circuit": "mail_short_circuit",
  "mail:invalid": "mail_invalid_recipients",
  "mail:attachments": "mail_with_attachments",
  "mail:recovery": "mail_recovery",
  "mail:standard": "mail_standard",
  "feed:atom": "feed_atom",
  "feed:rss2": "feed_rss2",
  "feed:comments": "feed_comments",
  "feed:opml": "feed_opml",
  "feed:remote": "feed_fetch_remote",
  "feed:unknown": "feed_unknown",
  "embed:rest": "embed_rest_response",
  "embed:template": "embed_template",
  "embed:shortcode": "embed_shortcode",
  "embed:discovery": "embed_discovery",
  "embed:disabled": "embed_disabled",
  "https:already": "https_already",
  "https:migrate": "https_migrate",
  "https:detect": "https_detect",
  "https:noop": "https_noop",
  "privacy:export-mail": "privacy_export_mail",
  "privacy:erasure-mail": "privacy_erasure_mail",
  "privacy:list-table": "privacy_list_table",
  "ai-http:authenticated": "ai_http_authenticated",
  "ai-http:discovery": "ai_http_discovery",
  "ai-http:transport": "ai_http_transport",
  "trackback:reject": "trackback_reject",
  "trackback:accept": "trackback_accept",
  "trackback:ping": "trackback_ping",
  "hook:http": "http_hooks",
  "hook:cron": "cron_hooks",
  "hook:mail": "mail_hooks",
  "hook:feed": "feed_hooks",
  "hook:embed": "embed_hooks",
  "hook:failed": "http_cron_mail_feed_embed_no_hooks"
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
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function stableGeneratedContents(data) {
  return data
    .toString("utf8")
    .replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
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

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-312-http-cron-mail-feed-embed-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/http-cron-mail-feed-embed-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "HTTP transport, cron, mail, feed, embed, HTTPS, privacy request, AI-client HTTP, and trackback intent",
      area:
        "wp-includes/http.php, class-wp-http.php, cron.php, class-phpmailer.php, class-wp-phpmailer.php, feed.php, class-oembed.php, embed.php, https-detection.php, wp-cron.php, wp-mail.php, wp-links-opml.php, wp-trackback.php",
      public_contract:
        "Haxe owns the first typed WPHX-312 adapter-contract decision model. Public PHP ABI replacement, live network I/O, cron locks/options, PHPMailer transport, feed XML output, embed/oEmbed rendering, HTTPS probes, and installed behavior are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Install these decisions through typed Adapter IR/original-path generation and pass PHP-authored HTTP, cron, mail, feed, embed/oEmbed, installed side-effect, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-http-cron-mail-feed-embed-adapter-contract-candidate",
        "npm run wp:core:wphx-312-http-cron-mail-feed-embed-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate. It adds no native provider, no handwritten production PHP shell, no live side-effect provider, and no public WordPress file replacement."
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

const manifest = {
  schema: "wphx.wp-core-http-cron-mail-feed-embed-adapter-contract-candidate.v1",
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
    candidate_kind: "haxe_http_cron_mail_feed_embed_adapter_contract_candidate",
    promoted_contracts: [
      "HTTP transport intent for preemption, policy blocking, cURL, streams, and error routes",
      "cron scheduling intent for due events, recurring reschedule, lock handling, spawn requests, and no-op paths",
      "mail dispatch intent for short-circuit, invalid recipients, attachments, recovery emails, and standard mail",
      "feed/OPML/fetch intent for Atom, RSS2, comment feeds, OPML, remote fetch, and unknown feed types",
      "embed/oEmbed intent for REST responses, discovery, shortcode handling, template requests, and disabled embeds",
      "HTTPS detection/migration intent for already-HTTPS, migration, detection, and no-op routes",
      "privacy request mail, AI-client HTTP, trackback, and hook intent"
    ],
    upstream_reference_functions: [
      "wp_remote_request",
      "WP_Http::request",
      "wp_schedule_event",
      "spawn_cron",
      "wp_mail",
      "fetch_feed",
      "do_feed_rss2",
      "WP_oEmbed",
      "WP_Embed",
      "wp_update_https_detection_errors",
      "wp_privacy_send_personal_data_export_email",
      "wp_trackback"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      native_provider_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP HTTP, cron, mail, feed, embed/oEmbed, and side-effect fixtures before claiming public PHP ABI ownership."
    },
    source_escape_audits: haxeSourceAudits
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_profile: command("php", ["-r", "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"])
  },
  build: {
    generated_file_hash_policy: "normalize_haxe_std_source_map_paths",
    generated_haxe_files: generatedFiles,
    php_lint: generatedPhpLintRecords(generatedFiles)
  },
  run: {
    command: `php ${ENTRY}`,
    raw_output_sha256: sha256(output),
    observations,
    matches_expected: matchesExpected
  },
  remaining_gaps: [
    {
      id: "php-authored-http-cron-mail-feed-embed-oracle-fixtures-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run through vanilla WordPress and packaged candidate public HTTP transport, cron option/lock/spawn, PHPMailer, feed XML, oEmbed/embed, HTTPS migration, privacy mail, trackback, hook, and cache observations."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path HTTP, cron, mail, feed, embed/oEmbed, HTTPS, privacy request, AI-client HTTP, OPML, or trackback adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_http_cron_mail_feed_embed_adapter_contract_candidate",
    promoted_contracts: 7,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "HTTP/cron/mail/feed/embed Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for HTTP/cron/mail/feed/embed Haxe candidate" },
    { path: "src/wphx/wp/http/HttpCronMailFeedEmbedAdapterContract.hx", role: "typed Haxe HTTP/cron/mail/feed/embed semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-http-cron-mail-feed-embed-adapter-contract-candidate",
    "npm run wp:core:wphx-312-http-cron-mail-feed-embed-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  related_receipts: ["receipt:wphx-312-01-http-cron-mail-feed-embed-surface"],
  validation_result: manifest.validation_result
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

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      observations: Object.keys(EXPECTED).length
    },
    null,
    2
  )
);
