#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.1",
  external_ref: "WPHX-312.01",
  title: "WPHX-312.01 - Inventory HTTP cron mail feed embed surface"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const RUNNER = "tools/wp-core/run-http-cron-mail-feed-embed-surface.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function stripSrc(path) {
  return path.startsWith("src/") ? path.slice(4) : path;
}

function isVendorPhpPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.startsWith("wp-includes/id3/") ||
    p.startsWith("wp-includes/phpmailer/") ||
    p.startsWith("wp-includes/requests/") ||
    p.startsWith("wp-includes/simplepie/") ||
    p.startsWith("wp-includes/sodium_compat/") ||
    p.includes("/paragonie/") ||
    p.includes("/random_compat/") ||
    p.includes("/simplepie/") ||
    p.includes("/phpmailer/")
  );
}

function isMultisitePath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.startsWith("wp-admin/network/") ||
    p.startsWith("wp-admin/includes/network.php") ||
    p.startsWith("wp-admin/includes/ms") ||
    p.startsWith("wp-includes/ms-") ||
    p.includes("multisite") ||
    p.includes("signup") ||
    (p.includes("site-health") && p.includes("multisite"))
  );
}

function ownerForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (isVendorPhpPath(p)) return "WPHX-323";
  if (p.startsWith("wp-content/themes/")) return "WPHX-320";
  if (p.startsWith("wp-content/plugins/")) return "WPHX-318";
  if (p.includes("wpdb") || p.includes("db.php") || p.includes("dbdelta")) return "WPHX-305";
  if (isMultisitePath(p)) return "WPHX-317";
  if (p.includes("rest-api") || p.includes("class-wp-rest") || p.includes("rest-")) return "WPHX-311";
  if (
    p.includes("user") ||
    p.includes("capabilities") ||
    p.includes("session-token") ||
    p.includes("pluggable") ||
    p.includes("auth") ||
    p.includes("application-password") ||
    p.includes("wp-login.php") ||
    p.includes("wp-activate.php")
  ) {
    return "WPHX-306";
  }
  if (p.includes("post") || p.includes("revision") || p.includes("class-wp-query") || p.includes("query.php") || p.includes("meta.php")) return "WPHX-307";
  if (p.includes("taxonomy") || p.includes("term") || p.includes("comment")) return "WPHX-308";
  if (p.includes("rewrite") || p.includes("canonical") || p.includes("link-template") || p.includes("template-loader") || p.includes("class-wp.php") || p.includes("wp-blog-header.php") || p.includes("index.php")) return "WPHX-309";
  if (
    p.includes("theme") ||
    p.includes("customize") ||
    p.includes("template") ||
    p.includes("theme-compat") ||
    p.includes("class-wp-theme") ||
    p.includes("global-styles") ||
    p.includes("script-modules")
  ) {
    return "WPHX-310";
  }
  if (
    p.includes("http") ||
    p.includes("requests") ||
    p.includes("cron") ||
    p.includes("mail") ||
    p.includes("feed") ||
    p.includes("embed") ||
    p.includes("oembed") ||
    p.includes("wp-cron.php") ||
    p.includes("wp-mail.php") ||
    p.includes("wp-links-opml.php") ||
    p.includes("wp-trackback.php")
  ) {
    return "WPHX-312";
  }
  if (p.includes("media") || p.includes("image") || p.includes("upload") || p.includes("filesystem") || p.includes("file.php") || p.includes("class-wp-filesystem") || p.includes("wp-content/index.php")) return "WPHX-313";
  if (p.includes("block") || p.includes("interactivity") || p.includes("style-engine") || p.includes("html-api") || p.includes("fonts") || p.includes("assets")) return "WPHX-314";
  if (p.startsWith("wp-admin/includes/class-wp-list-table") || p.includes("list-table") || p.includes("screen") || p.includes("menu") || p.includes("admin-header") || p.includes("admin-footer")) return "WPHX-315";
  if (p.startsWith("wp-admin/")) {
    if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("maintenance") || p.includes("recovery")) return "WPHX-319";
    if (p.includes("media") || p.includes("upload")) return "WPHX-313";
    if (p.includes("theme") || p.includes("customize")) return "WPHX-310";
    if (p.includes("ajax") || p.includes("async") || p.includes("network/") || p.includes("options-") || p.includes("tools") || p.includes("edit") || p.includes("post") || p.includes("term") || p.includes("comment")) return "WPHX-316";
    return "WPHX-315";
  }
  if (p.includes("xmlrpc") || p.includes("deprecated") || p.includes("legacy") || p.includes("class-ixr")) return "WPHX-318";
  if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("recovery") || p.includes("maintenance")) return "WPHX-319";
  if (p.includes("option") || p.includes("transient") || p.includes("cache")) return "WPHX-304";
  if (p.includes("formatting") || p.includes("kses") || p.includes("sanitize") || p.includes("class-wp-error") || p.includes("error") || p.includes("deprecated")) return "WPHX-303";
  if (p.includes("plugin") || p.includes("class-wp-hook") || p.includes("wp-settings.php")) return "WPHX-302";
  if (p === "wp-config-sample.php" || p === "wp-tests-config-sample.php" || p.includes("load.php") || p.includes("default-constants") || p.includes("version.php") || p.includes("compat.php") || p.includes("wp-load.php") || p.includes("wp-settings.php")) return "WPHX-301";
  return "WPHX-301";
}

function groupForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (p.includes("php-ai-client")) return "ai_client_http";
  if (p.includes("privacy") && p.includes("request")) return "privacy_request_mail";
  if (p.includes("cron") || p.includes("schedule")) return "cron_scheduling";
  if (p.includes("phpmailer") || p.includes("mail") || p.includes("recovery-mode-email")) return "mail_phpmailer";
  if (p.includes("https-detection") || p.includes("https-migration")) return "https_detection_migration";
  if (p.includes("oembed") || p.includes("embed")) return "embeds_oembed";
  if (p.includes("feed") || p.includes("wp-links-opml.php")) return "feeds_opml";
  if (p.includes("trackback")) return "trackbacks";
  if (p.includes("http") || p.includes("requests")) return "http_transport_requests";
  return "http_cron_mail_feed_embed_related";
}

function isC1Source(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-312";
}

function isC1Artifact(entry) {
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-312";
}

function summarizeByGroup(entries) {
  const groups = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    groups[group] ??= { count: 0, paths: [] };
    groups[group].count++;
    groups[group].paths.push(entry.path);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function symbolSummary(entries) {
  const byGroup = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    byGroup[group] ??= { count: 0, functions: [], classes: [], methods: [], properties: [] };
    byGroup[group].count++;
    if (entry.kind === "function" && byGroup[group].functions.length < 160) byGroup[group].functions.push(entry.name);
    if (entry.kind === "class" && byGroup[group].classes.length < 120) byGroup[group].classes.push(entry.name);
    if (entry.kind === "method" && byGroup[group].methods.length < 180) byGroup[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && byGroup[group].properties.length < 140) byGroup[group].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/cron") ||
    p.includes("/feed") ||
    p.includes("/http") ||
    p.includes("/oembed") ||
    p.includes("/embed") ||
    p.includes("wpaiClienthttpclient".toLowerCase()) ||
    p.includes("https-detection") ||
    p.includes("https-migration") ||
    p.includes("wpgethttpheaders") ||
    p.includes("wpremoteRetrieveHeaders".toLowerCase()) ||
    p.includes("wp-mail") ||
    p.includes("wpmail") ||
    p.includes("phpmailer") ||
    p.includes("trackback") ||
    p.includes("getfeed") ||
    p.includes("feedlinks") ||
    p.includes("privacysendpersonaldataexportemail")
  );
}

function semanticKeywordPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.includes("http") ||
    p.includes("requests") ||
    p.includes("cron") ||
    p.includes("mail") ||
    p.includes("feed") ||
    p.includes("embed") ||
    p.includes("oembed") ||
    p.includes("trackback") ||
    p.includes("privacy") ||
    p.includes("https")
  );
}

function handoffReason(owner) {
  if (owner === "WPHX-306") return "Authentication, capability, and pluggable-user checks are user/auth-domain behavior even when mail or HTTP surfaces call them.";
  if (owner === "WPHX-307") return "Post/query state feeds embeds, enclosure, and oEmbed response data, but content ownership remains WPHX-307.";
  if (owner === "WPHX-308") return "Comment and taxonomy feed state intersects feed rendering, but term/comment ownership remains WPHX-308.";
  if (owner === "WPHX-309") return "Canonical, link, and routing helpers expose feed/embed URLs, but request routing remains WPHX-309.";
  if (owner === "WPHX-310") return "Embed theme-compat templates and front-end template shells are rendered through theme/template ownership.";
  if (owner === "WPHX-311") return "oEmbed REST controllers and response schemas are REST-domain behavior that consume embed providers.";
  if (owner === "WPHX-313") return "Media enclosure and upload paths intersect feeds and embeds, but media/filesystem behavior remains WPHX-313.";
  if (owner === "WPHX-315" || owner === "WPHX-316") return "Admin privacy/export screens expose request-mail state, but admin screen implementation remains admin-domain work.";
  if (owner === "WPHX-318") return "XML-RPC and legacy trackback callers consume feed/mail helpers, but XML-RPC and deprecated APIs remain WPHX-318.";
  if (owner === "WPHX-323") return "Bundled vendor libraries remain vendor-closure material even when WPHX-312 owns WordPress integration seams.";
  return "Current owner rules assign this path to another domain; WPHX-312 must coordinate observable behavior without changing ownership here.";
}

function handoffCandidates(entries) {
  return entries
    .filter((entry) => semanticKeywordPath(entry.path) && ownerForPath(entry.path) !== "WPHX-312")
    .map((entry) => {
      const owner = ownerForPath(entry.path);
      return {
        path: entry.path,
        owner,
        reason: handoffReason(owner)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 160);
}

function closureSnapshot(closure) {
  const source = closure.coverage?.source_by_owner?.["WPHX-312"] ?? null;
  const artifacts = closure.coverage?.artifact_by_owner?.["WPHX-312"] ?? null;
  return {
    source_count: source?.count ?? null,
    artifact_count: artifacts?.count ?? null,
    source_samples: source?.samples ?? [],
    artifact_samples: artifacts?.samples ?? []
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-http-cron-mail-feed-embed-surface`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const allSource = readJsonl(SOURCE).filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source");
const source = allSource.filter(isC1Source);
const artifacts = readJsonl(ARTIFACTS).filter(isC1Artifact);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const closure = readJson(FIRST_PARTY_CLOSURE);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const functionsWithReferences = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference));
const methodsWithReferences = abiEntries.filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.by_reference));
const variadicFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.variadic));
const variadicMethods = abiEntries.filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.variadic));

const manifest = {
  schema: "wphx.wp-core-http-cron-mail-feed-embed-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    runner: inputRecord(RUNNER),
    source_inventory: inputRecord(SOURCE),
    artifact_inventory: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    abi_manifest: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE)
  },
  scope: {
    source_files: {
      count: source.length,
      by_group: summarizeByGroup(source)
    },
    distribution_artifacts: {
      count: artifacts.length,
      by_group: summarizeByGroup(artifacts)
    },
    abi: {
      count: abiEntries.length,
      by_group: symbolSummary(abiEntries),
      functions_with_reference_parameters: functionsWithReferences.map((entry) => entry.name),
      methods_with_reference_parameters: methodsWithReferences.map((entry) => entry.qualified_name ?? entry.name),
      variadic_functions: variadicFunctions.map((entry) => entry.name),
      variadic_methods: variadicMethods.map((entry) => entry.qualified_name ?? entry.name)
    },
    upstream_tests: {
      count: tests.length,
      paths: tests.map((entry) => entry.path).sort()
    },
    first_party_closure: closureSnapshot(closure),
    cross_domain_handoffs: handoffCandidates(allSource)
  },
  coverage: {
    feature_groups: [
      "http_transport_requests",
      "ai_client_http",
      "cron_scheduling",
      "mail_phpmailer",
      "feeds_opml",
      "embeds_oembed",
      "https_detection_migration",
      "privacy_request_mail",
      "trackbacks"
    ],
    side_effect_boundaries: [
      "network I/O and HTTP transport selection",
      "external provider discovery for oEmbed and AI-client HTTP",
      "cron option mutation, locks, scheduling, and spawned loopbacks",
      "mail transport, PHPMailer configuration, headers, attachments, and recovery emails",
      "feed query state, XML output, SimplePie/fetch_feed integration, OPML, and enclosures",
      "embed discovery, shortcode rendering, REST oEmbed response handoff, and theme-compat templates",
      "HTTPS detection/migration probes and site URL state",
      "trackback receipt, sanitization, and ping side effects"
    ],
    expected_followup_gates: [
      "typed_haxe_http_cron_mail_feed_embed_adapter_contract",
      "deterministic_http_transport_fixture",
      "cron_schedule_lock_spawn_fixture",
      "mail_phpmailer_fixture",
      "feed_oembed_embed_fixture",
      "installed_network_mail_feed_embed_gate",
      "selected_upstream_http_cron_mail_feed_embed_phpunit_ratchets"
    ]
  },
  evidence_plan: {
    current_claim: "surface_inventory_only",
    behavior_parity_claimed: false,
    haxe_runtime_ownership_claimed: false,
    public_php_replacement_claimed: false,
    next: [
      "Add typed Haxe adapter-contract candidate for HTTP transport, cron scheduling, mail dispatch, feed rendering, and embed/oEmbed intent.",
      "Add deterministic fixtures for HTTP response/error behavior, cron option mutation and locking, PHPMailer setup, feed XML, oEmbed discovery, and embed rendering.",
      "Add installed-style network/mail/feed/embed observations and selected upstream PHPUnit ratchets before domain closure."
    ]
  },
  validation_result: {
    status: "passed",
    source_files: source.length,
    distribution_artifacts: artifacts.length,
    abi_entries: abiEntries.length,
    upstream_tests: tests.length,
    behavior_parity_claimed: false
  }
};

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/http-cron-mail-feed-embed-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "source_surface_inventory",
      name: "HTTP, Requests integration, cron, mail, feeds, embeds, oEmbed, XML feed output",
      area: "wp-includes HTTP APIs, Requests/AI-client HTTP integration, cron scheduling, PHPMailer/mail, feed output, embeds/oEmbed, OPML, trackbacks, and privacy request mail tables",
      public_contract:
        "This inventory maps the WPHX-312 source, distribution, ABI, test, side-effect, and handoff surface. It does not claim Haxe runtime ownership, network/mail/scheduling parity, or generated public PHP replacement."
    },
    ownership_state: "inventory_only",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "not_claimed",
      execution_provider: "not_claimed",
      compatibility_evidence: "surface_inventory"
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      commands: [
        "npm run wp:core:wphx-312-http-cron-mail-feed-embed-surface",
        "npm run wp:core:wphx-312-http-cron-mail-feed-embed-surface:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-312-01-http-cron-mail-feed-embed-surface"],
      manifest_digest: manifestSha
    }
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "HTTP/cron/mail/feed/embed surface manifest" },
      { path: OWNERSHIP, role: "HTTP/cron/mail/feed/embed surface ownership manifest" },
      { path: RUNNER, role: "deterministic surface inventory generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-http-cron-mail-feed-embed-surface",
      "npm run wp:core:wphx-312-http-cron-mail-feed-embed-surface:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: ["receipt:wphx-322-php-first-party-manifest-closure"],
    manifest_sha256: manifestSha,
    validation_result: manifest.validation_result
  };
}

const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`;
const manifestSha = sha256(manifestContents);
writeOrCheck(OUT, manifestContents);
writeOrCheck(OWNERSHIP, `${JSON.stringify(ownershipManifest(manifestSha), null, 2)}\n`);
writeOrCheck(RECEIPT, `${JSON.stringify(receipt(manifestSha), null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      source_files: source.length,
      distribution_artifacts: artifacts.length,
      abi_entries: abiEntries.length,
      upstream_tests: tests.length
    },
    null,
    2
  )
);
