#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-jsqa",
  external_ref: "WPHX-318.05",
  title: "WPHX-318.05 - Declare XML-RPC installed route gates"
};
const RECORDED_AT = "2026-07-04T13:00:00.000Z";
const RUNNER = "tools/wp-core/run-xmlrpc-installed-route-gates.mjs";
const UPSTREAM_ROOT = "../wordpress-develop";
const OUT = "manifests/wp-core/wphx-318-05-xmlrpc-installed-route-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-318-05-xmlrpc-installed-route-gates.v1.json";

const EVIDENCE_DEPENDENCIES = [
  {
    id: "wphx-318-01-surface",
    path: "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json",
    role: "XML-RPC, legacy, deprecated, bundled plugin, and IXR source/artifact/ABI/test surface inventory"
  },
  {
    id: "wphx-318-02-adapter-contract",
    path: "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json",
    role: "typed Haxe adapter-contract intent for selected XML-RPC endpoint, method-family, guard, IXR, boundary, and handoff decisions"
  },
  {
    id: "wphx-318-03-endpoint-server-fixture",
    path: "manifests/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json",
    role: "copied-oracle endpoint/server observations through deterministic WordPress stubs"
  },
  {
    id: "wphx-318-04-upstream-ratchets",
    path: "manifests/wp-core/wphx-318-04-xmlrpc-legacy-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit ratchet scope for XML-RPC endpoint/demo/message, method-family, and legacy/deprecated helper tests"
  },
  {
    id: "upstream-lock",
    path: "upstream.lock.json",
    role: "WordPress 7.0 oracle checkout path and revision authority"
  }
];

const UPSTREAM_SOURCE_FILES = [
  "src/xmlrpc.php",
  "src/wp-includes/class-wp-xmlrpc-server.php",
  "src/wp-includes/class-IXR.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/deprecated.php"
];

const UPSTREAM_TEST_FILES = [
  "tests/phpunit/tests/xmlrpc/basic.php",
  "tests/phpunit/tests/xmlrpc/client.php",
  "tests/phpunit/tests/xmlrpc/demo/addTwoNumbers.php",
  "tests/phpunit/tests/xmlrpc/message.php",
  "tests/phpunit/tests/xmlrpc/wp/getOptions.php",
  "tests/phpunit/tests/xmlrpc/wp/getUsers.php",
  "tests/phpunit/tests/xmlrpc/wp/getUsers.php",
  "tests/phpunit/tests/xmlrpc/wp/newPost.php",
  "tests/phpunit/tests/xmlrpc/wp/uploadFile.php",
  "tests/phpunit/tests/xmlrpc/mw/newPost.php",
  "tests/phpunit/tests/xmlrpc/wp/newComment.php",
  "tests/phpunit/tests/xmlrpc/wp/newTerm.php",
  "tests/phpunit/tests/date/xmlrpc.php",
  "tests/phpunit/tests/functions/xmlrpc.php"
];

const SELECTED_ROUTE_GATES = [
  {
    id: "xmlrpc-rsd-discovery-get",
    request: {
      method: "GET",
      path: "/xmlrpc.php?rsd",
      body_kind: "none"
    },
    expected_oracle_surface:
      "RSD XML output emitted by xmlrpc.php without loading an XML-RPC method envelope, including hookable xmlrpc endpoint URL and API fragments.",
    existing_evidence_refs: ["WPHX-318.01", "WPHX-318.03"],
    upstream_refs: ["src/xmlrpc.php"],
    cross_domain_handoffs: ["WPHX-312"],
    blockers: [
      "No installed oracle/candidate HTTP roots are provisioned for XML-RPC route execution.",
      "No generated candidate overlay manifest exists for xmlrpc.php or XML-RPC server files.",
      "No installed HTTP runner has recorded real headers, status, output body, or hook order for the RSD route."
    ]
  },
  {
    id: "xmlrpc-non-post-rejection",
    request: {
      method: "GET",
      path: "/xmlrpc.php",
      body_kind: "none"
    },
    expected_oracle_surface:
      "Non-RSD GET requests to xmlrpc.php are rejected with the public XML-RPC POST-only response and WordPress bootstrap state intact.",
    existing_evidence_refs: ["WPHX-318.01", "WPHX-318.02"],
    upstream_refs: ["src/xmlrpc.php"],
    cross_domain_handoffs: ["WPHX-303"],
    blockers: [
      "No installed route runner compares HTTP status, content type, response body, and bootstrap side effects.",
      "No generated public xmlrpc.php adapter exists.",
      "No installed log/error capture exists for wp_die/output behavior."
    ]
  },
  {
    id: "xmlrpc-malformed-envelope-fault",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "malformed_xml"
    },
    expected_oracle_surface:
      "IXR request parsing reports the WordPress XML-RPC parse fault shape for malformed XML without invoking application method handlers.",
    existing_evidence_refs: ["WPHX-318.02", "WPHX-318.04"],
    upstream_refs: ["src/wp-includes/class-IXR.php", "tests/phpunit/tests/xmlrpc/message.php"],
    cross_domain_handoffs: ["WPHX-323"],
    blockers: [
      "No installed HTTP runner executes POST bodies through IXR_Message/IXR_Server over xmlrpc.php.",
      "No generated or accepted preserved-boundary IXR parser/serializer ownership gate exists.",
      "No wire-level XML response comparison exists for fault serialization."
    ]
  },
  {
    id: "xmlrpc-system-demo-public-methods",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["system.listMethods", "demo.sayHello", "demo.addTwoNumbers"]
    },
    expected_oracle_surface:
      "Public system/demo XML-RPC method envelopes dispatch through wp_xmlrpc_server and return serialized XML-RPC method-list/string/int responses.",
    existing_evidence_refs: ["WPHX-318.02", "WPHX-318.03", "WPHX-318.04"],
    upstream_refs: [
      "src/wp-includes/class-wp-xmlrpc-server.php",
      "tests/phpunit/tests/xmlrpc/basic.php",
      "tests/phpunit/tests/xmlrpc/demo/addTwoNumbers.php"
    ],
    cross_domain_handoffs: ["WPHX-323"],
    blockers: [
      "No installed POST runner records method envelope serialization through the real route.",
      "No generated original-path adapter exists for wp_xmlrpc_server method registry and public methods.",
      "No plugin/filter ecosystem gate exists for xmlrpc_methods and wp_xmlrpc_server_class under installed HTTP execution."
    ]
  },
  {
    id: "xmlrpc-auth-failure-and-enabled-filter",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["wp.getOptions"],
      credentials: "invalid_or_disabled"
    },
    expected_oracle_surface:
      "Authentication failure and XML-RPC enabled/disabled filter paths return the native IXR_Error code/message shape without leaking successful method data.",
    existing_evidence_refs: ["WPHX-318.02", "WPHX-318.03", "WPHX-318.04"],
    upstream_refs: ["src/wp-includes/class-wp-xmlrpc-server.php", "tests/phpunit/tests/xmlrpc/basic.php"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-304"],
    blockers: [
      "No installed candidate has real users, password hashing, current-user state, options, and filter execution for XML-RPC auth.",
      "No generated overlay exists for XML-RPC auth/error branches.",
      "No database-backed oracle/candidate comparison exists for option-driven XML-RPC enablement."
    ]
  },
  {
    id: "xmlrpc-authenticated-read-methods",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["wp.getUsersBlogs", "wp.getUsers", "wp.getOptions"]
    },
    expected_oracle_surface:
      "Authenticated read-only WordPress XML-RPC methods return blog/user/option structures with WordPress-native field names, capabilities, dates, and XML serialization.",
    existing_evidence_refs: ["WPHX-318.03", "WPHX-318.04"],
    upstream_refs: [
      "src/wp-includes/class-wp-xmlrpc-server.php",
      "tests/phpunit/tests/xmlrpc/wp/getUsers.php",
      "tests/phpunit/tests/xmlrpc/wp/getOptions.php"
    ],
    cross_domain_handoffs: ["WPHX-306", "WPHX-317", "WPHX-304"],
    blockers: [
      "No installed database/user/blog seed exists for real XML-RPC read methods.",
      "No candidate generated overlay exists for wp_xmlrpc_server read method families.",
      "No XML wire comparison records native array/object/date output for authenticated installed HTTP responses."
    ]
  },
  {
    id: "xmlrpc-content-write-methods",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["wp.newPost", "mw.newPost", "wp.newComment", "wp.newTerm"]
    },
    expected_oracle_surface:
      "Authenticated content-write methods enforce capabilities, slashing/date/status/taxonomy/comment behavior, database writes, hook firing, and XML-RPC response serialization.",
    existing_evidence_refs: ["WPHX-318.02", "WPHX-318.04"],
    upstream_refs: [
      "tests/phpunit/tests/xmlrpc/wp/newPost.php",
      "tests/phpunit/tests/xmlrpc/mw/newPost.php",
      "tests/phpunit/tests/xmlrpc/wp/newComment.php",
      "tests/phpunit/tests/xmlrpc/wp/newTerm.php",
      "tests/phpunit/tests/date/xmlrpc.php"
    ],
    cross_domain_handoffs: ["WPHX-306", "WPHX-307", "WPHX-308"],
    blockers: [
      "No installed XML-RPC runner compares database deltas, hook traces, and XML wire responses for write methods.",
      "No generated overlay exists for XML-RPC post/comment/term write method handlers.",
      "No cross-domain installed state gate exists for posts/query, taxonomy/comment, users/capabilities, and date conversion under XML-RPC."
    ]
  },
  {
    id: "xmlrpc-media-upload-method",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["wp.uploadFile", "metaWeblog.newMediaObject"]
    },
    expected_oracle_surface:
      "Authenticated XML-RPC media upload methods enforce upload capabilities, file validation, attachment creation, and XML-RPC response field shape.",
    existing_evidence_refs: ["WPHX-318.02", "WPHX-318.04"],
    upstream_refs: ["tests/phpunit/tests/xmlrpc/wp/uploadFile.php"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-313"],
    blockers: [
      "No installed uploads/filesystem fixture exists for XML-RPC media writes.",
      "No candidate generated overlay exists for upload handlers reached through XML-RPC.",
      "No filesystem/database/XML response diff gate exists for uploaded attachment state."
    ]
  },
  {
    id: "xmlrpc-pingback-methods",
    request: {
      method: "POST",
      path: "/xmlrpc.php",
      body_kind: "xml_method_call",
      representative_methods: ["pingback.ping", "pingback.extensions.getPingbacks"]
    },
    expected_oracle_surface:
      "Pingback XML-RPC methods preserve HTTP fetch policy, comment/trackback state, duplicate/error handling, and serialized success/fault responses.",
    existing_evidence_refs: ["WPHX-318.01", "WPHX-318.02"],
    upstream_refs: ["src/wp-includes/class-wp-xmlrpc-server.php"],
    cross_domain_handoffs: ["WPHX-312", "WPHX-308"],
    blockers: [
      "No controlled HTTP/pingback installed fixture exists for source/target URL fetch behavior.",
      "No generated overlay exists for pingback XML-RPC method handlers.",
      "No database/comment diff and live-or-recorded HTTP transport gate exists for pingback behavior."
    ]
  }
];

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

function upstreamRecord(relativePath) {
  const path = join(UPSTREAM_ROOT, relativePath);
  if (!existsSync(path)) throw new Error(`Missing upstream file: ${path}`);
  return {
    path,
    relative_path: relativePath,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run ${RUNNER}`);
    const current = readFileSync(path, "utf8");
    if (current !== body) throw new Error(`${path} is stale; run ${RUNNER}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  for (const dependency of EVIDENCE_DEPENDENCIES) {
    if (!existsSync(dependency.path)) throw new Error(`Missing evidence dependency: ${dependency.path}`);
  }

  const upstreamSources = UPSTREAM_SOURCE_FILES.map(upstreamRecord);
  const upstreamTests = [...new Set(UPSTREAM_TEST_FILES)].map(upstreamRecord);
  const routeGates = SELECTED_ROUTE_GATES.map((gate) => ({
    ...gate,
    provisioning_status: "blocked",
    classification: "blocked_no_wphx_318_installed_xmlrpc_http_runner",
    generated_overlay_required_before_candidate_divergence: true
  }));

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "installed_xmlrpc_route_gate_declaration",
    artifact_scope: "selected_installed_http_route_scope",
    behavior_parity_claimed: false,
    installed_xmlrpc_route_execution_claimed: false,
    xmlrpc_request_response_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_xmlrpc_runtime_claimed: false,
    candidate_generated_overlay_claimed: false,
    selected_gate_scope_declared: true,
    selected_route_gate_count: routeGates.length,
    selected_upstream_source_count: upstreamSources.length,
    selected_upstream_test_count: upstreamTests.length,
    upstream_source_authority: {
      path: UPSTREAM_ROOT,
      role: "read-only WordPress 7.0 oracle checkout",
      route: "src/xmlrpc.php",
      test_root: "tests/phpunit/tests/xmlrpc"
    },
    inputs: {
      runner: inputRecord(RUNNER),
      evidence_dependencies: EVIDENCE_DEPENDENCIES.map((dependency) => ({
        ...dependency,
        ...inputRecord(dependency.path)
      })),
      upstream_sources: upstreamSources,
      upstream_tests: upstreamTests
    },
    selected_installed_xmlrpc_route_gates: routeGates,
    future_runner_requirements: [
      "Provision oracle and candidate installed WordPress roots with identical database seeds, users, salts, options, uploads, plugins, rewrite config, and multisite state where applicable.",
      "Dispatch selected HTTP requests through real xmlrpc.php and WordPress bootstrap under a PHP server, not deterministic bridge routers.",
      "Require a non-empty generated candidate overlay manifest before any candidate package file differs from copied upstream PHP.",
      "Compare HTTP status, headers, raw XML response bodies, IXR faults/success values, PHP logs, hook traces, and database/filesystem deltas.",
      "Record XML request fixtures, response-normalization rules, candidate overlay hashes, selected upstream PHPUnit links, and cross-domain ownership handoffs.",
      "Keep pingback and remote-media behavior behind controlled local HTTP fixtures or recorded-network gates before live-network claims."
    ],
    cross_domain_handoffs: [
      {
        owner: "WPHX-303",
        reason: "XML-RPC wp_die/error/fault signaling and deprecated helper notices remain error/deprecation ownership."
      },
      {
        owner: "WPHX-306",
        reason: "Authentication, users, passwords, current user state, roles, and capabilities remain users/auth ownership."
      },
      {
        owner: "WPHX-307/WPHX-308",
        reason: "Post/page/comment/term read-write semantics and database state remain posts/query and taxonomy/comment ownership."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "Pingback HTTP transport, remote fetch policy, feed/embed boundaries, uploads, media validation, and filesystem behavior remain neighboring domains."
      },
      {
        owner: "WPHX-317/WPHX-323",
        reason: "Multisite blog routing and preserved IXR/vendor-library policy remain separate gates."
      }
    ],
    non_claims: [
      "This artifact declares WPHX-318 installed XML-RPC HTTP route gate scope only; it does not execute HTTP requests through installed WordPress.",
      "No generated public PHP replacement for xmlrpc.php, wp-includes/class-wp-xmlrpc-server.php, wp-includes/class-IXR.php, wp-includes/deprecated.php, bundled plugin files, or preserved IXR library files is claimed.",
      "No Haxe-owned XML-RPC runtime logic, IXR parser/serializer implementation, deprecated API runtime implementation, or installed XML-RPC request/response parity is claimed.",
      "No database-backed candidate behavior, real users/capabilities/passwords, post/comment/term/media writes, pingback transport, browser/e2e behavior, generated overlay, or generated original-path adapter ownership is claimed.",
      "The selected route gates are future blockers and scope declarations; their source hashes are not pass/pass installed execution evidence."
    ],
    validation_result: {
      status: "passed",
      selected_route_gate_count: routeGates.length,
      selected_upstream_source_count: upstreamSources.length,
      selected_upstream_test_count: upstreamTests.length,
      route_provisioning_status: "blocked",
      behavior_parity_claimed: false,
      installed_xmlrpc_route_execution_claimed: false,
      xmlrpc_request_response_parity_claimed: false,
      future_runner_required: true
    }
  };

  const receipt = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    status: "passed",
    generator: RUNNER,
    evidence: {
      manifest: OUT,
      surface_manifest: "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json",
      adapter_contract_manifest: "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json",
      endpoint_server_fixture_manifest: "manifests/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json",
      upstream_ratchets_manifest: "manifests/wp-core/wphx-318-04-xmlrpc-legacy-upstream-ratchets.v1.json",
      upstream_lock: "upstream.lock.json"
    },
    summary:
      "Declares nine selected WPHX-318 installed XML-RPC HTTP route gates over RSD discovery, non-POST rejection, malformed IXR envelopes, public system/demo methods, auth failure/enabled filters, authenticated read methods, content writes, media upload, and pingback methods. Every selected gate remains blocked until real installed oracle/candidate roots, generated-overlay discipline, database/user/capability state, HTTP XML-RPC execution, and wire/database/filesystem comparison exist.",
    checks: [`node ${RUNNER}`, `node ${RUNNER} --check`, "npm run receipts:validate", "npm run beads:validate"],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        selected_route_gate_count: routeGates.length,
        route_provisioning_status: "blocked",
        behavior_parity_claimed: false,
        installed_xmlrpc_route_execution_claimed: false,
        output: OUT,
        receipt: RECEIPT
      },
      null,
      2
    )
  );
}

main();
