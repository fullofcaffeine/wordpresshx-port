#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-jh34",
  external_ref: "WPHX-323.10",
  title: "Add Snoopy legacy compatibility and exception gate"
};
const RECORDED_AT = "2026-07-07T17:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-snoopy-legacy-exception-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-10";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const SERVER = `${OUT_ROOT}/snoopy-loopback-server.mjs`;
const PROBE = `${OUT_ROOT}/snoopy-legacy-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const HTTP_GATES = "manifests/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const MAGPIE_FETCH = "manifests/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json";
const XMLRPC_SURFACE = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const OUT = "manifests/wp-core/wphx-323-10-snoopy-legacy-exception-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-10-snoopy-legacy-exception-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-10-snoopy-legacy-exception-gate.v1.json";

const SNOOPY_SOURCE = "src/wp-includes/class-snoopy.php";
const SNOOPY_DISTRIBUTION = "wp-includes/class-snoopy.php";
const REQUIRED_METHODS = [
  "fetch",
  "submit",
  "fetchlinks",
  "fetchform",
  "fetchtext",
  "submitlinks",
  "submittext",
  "set_submit_multipart",
  "set_submit_normal",
  "_httprequest",
  "_httpsrequest",
  "setcookies",
  "_connect",
  "_prepare_post_body"
];
const FIXTURE_CASES = [
  { id: "snoopy:reflection-defaults", focus: "plugin-visible class, default public fields, methods, and upstream deprecation include behavior" },
  { id: "snoopy:fetch-http", focus: "fetch GET request headers, cookies sent by caller, status/header/body fields, and _httprequest path" },
  { id: "snoopy:submit-form", focus: "submit POST form body, content type, request method, and response fields" },
  { id: "snoopy:fetchlinks", focus: "fetchlinks strips and expands relative, root-relative, absolute, and mailto links" },
  { id: "snoopy:fetchform", focus: "fetchform strips form/input/select/textarea markup from fetched HTML" },
  { id: "snoopy:fetchtext", focus: "fetchtext strips script/tags and decodes legacy entities" },
  { id: "snoopy:submitlinks-submittext", focus: "submitlinks and submittext preserve post-submission extraction behavior" },
  { id: "snoopy:redirect-cookie", focus: "redirect following, setcookies, lastredirectaddr, and cookie pass-through" },
  { id: "snoopy:post-body-helpers", focus: "set_submit_normal, set_submit_multipart, and _prepare_post_body body shapes" },
  { id: "snoopy:https-fake-curl", focus: "_httpsrequest command path through a deterministic fake curl executable" },
  { id: "snoopy:invalid-protocol", focus: "invalid protocol error/status/result shape" },
  { id: "snoopy:connect-failure", focus: "_connect failure status/error shape with normalized host errno" }
];
const REMAINING_GAPS = [
  {
    id: "real-timeout",
    status: "blocked",
    reason: "The gate records read_timeout defaults and connect failure behavior, but does not sleep a socket long enough to make timing-sensitive timeout evidence stable."
  },
  {
    id: "real-https-curl-binary",
    status: "blocked",
    reason: "The _httpsrequest path is exercised with a deterministic fake curl executable. Real external curl, TLS verification, proxy, and certificate behavior remain outside this renewed Snoopy exception gate."
  },
  {
    id: "ecosystem-plugin-scan",
    status: "blocked",
    reason: "The caller review scans WordPress 7.0 source-domain evidence only. Broad plugin-directory Snoopy usage pressure requires a later ecosystem scan before choosing replacement over preservation."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

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

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
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

function mirrorSource(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dirname(mirrorPath(root, SNOOPY_SOURCE)), { recursive: true });
  copyFileSync(upstreamPath(SNOOPY_SOURCE), mirrorPath(root, SNOOPY_SOURCE));
}

function writeServer() {
  mkdirSync(dirname(SERVER), { recursive: true });
  writeFileSync(
    SERVER,
    `import { createServer } from "node:http";

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function send(response, status, body, headers = {}) {
  response.sendDate = false;
  const payload = Buffer.from(body, "utf8");
  response.writeHead(status, {
    "Connection": "close",
    "Content-Length": String(payload.length),
    ...headers
  });
  response.end(payload);
}

function sendJson(response, status, payload, headers = {}) {
  send(response, status, JSON.stringify(payload), {
    "Content-Type": "application/json",
    "X-Snoopy-Gate": "loopback",
    ...headers
  });
}

const html = \`<!doctype html>
<html>
  <head><title>Snoopy fixture</title><script>window.nope = true;</script></head>
  <body>
    <a href="/alpha">Alpha</a>
    <a href="relative/beta">Beta</a>
    <a href="http://example.test/gamma">Gamma</a>
    <a href="mailto:fixture@example.test">Mail</a>
    <p>Fish &amp; Chips &copy; fixture</p>
  </body>
</html>\`;

const form = \`<!doctype html>
<form action="/submit" method="post">
  <input type="text" name="alpha" value="one">
  <select name="choice"><option value="a">A</option></select>
  <textarea name="body">Text area</textarea>
</form>\`;

const server = createServer(async (request, response) => {
  response.sendDate = false;
  const url = new URL(request.url, "http://127.0.0.1");
  const body = await readBody(request);

  if (url.pathname === "/inspect" || url.pathname === "/submit") {
    sendJson(response, 200, {
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: request.headers,
      body
    }, {
      "Set-Cookie": "simple=server-cookie; Path=/",
      "X-Snoopy-Case": url.searchParams.get("case") || "none"
    });
    return;
  }

  if (url.pathname === "/html" || url.pathname === "/html-post") {
    send(response, 200, html, {
      "Content-Type": "text/html",
      "X-Snoopy-Case": url.pathname.slice(1)
    });
    return;
  }

  if (url.pathname === "/form") {
    send(response, 200, form, {
      "Content-Type": "text/html",
      "X-Snoopy-Case": "form"
    });
    return;
  }

  if (url.pathname === "/redirect") {
    send(response, 302, "redirecting", {
      "Location": "/final",
      "Set-Cookie": "legacy=jar; Path=/",
      "X-Snoopy-Case": "redirect"
    });
    return;
  }

  if (url.pathname === "/final") {
    sendJson(response, 200, {
      method: request.method,
      path: url.pathname,
      headers: request.headers,
      body
    }, {
      "X-Snoopy-Case": "final"
    });
    return;
  }

  send(response, 404, "not found", {
    "Content-Type": "text/plain",
    "X-Snoopy-Case": "missing"
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  console.log(JSON.stringify({ port: address.port, baseUrl: \`http://127.0.0.1:\${address.port}\` }));
});
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', '0' );
ini_set( 'log_errors', '0' );

$root = $argv[1] ?? '';
$base_url = $argv[2] ?? '';

$GLOBALS['wphx_deprecated_files'] = array();
$GLOBALS['wphx_errors'] = array();
$GLOBALS['wphx_base_url'] = $base_url;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => normalize_value( $errstr ),
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

define( 'WPINC', 'wp-includes' );

function _deprecated_file( $file, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated_files'][] = array(
\t\t'file' => $file,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t);
}

function normalize_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$normalized = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$normalized[ $key ] = normalize_value( $item );
\t\t}
\t\treturn $normalized;
\t}
\tif ( is_object( $value ) ) {
\t\treturn normalize_value( get_object_vars( $value ) );
\t}
\tif ( is_string( $value ) ) {
\t\t$value = str_replace( $GLOBALS['wphx_base_url'], 'http://127.0.0.1:PORT', $value );
\t\t$value = preg_replace( '/127\\\\.0\\\\.0\\\\.1:\\\\d+/', '127.0.0.1:PORT', $value );
\t\t$value = preg_replace( '/Snoopy[a-f0-9]{32}/', 'SnoopyBOUNDARY', $value );
\t\t$value = preg_replace( '/connection failed \\\\(\\\\d+\\\\)/', 'connection failed (ERRNO)', $value );
\t\treturn $value;
\t}
\treturn $value;
}

function decode_json_result( $value ) {
\t$decoded = json_decode( $value, true );
\treturn is_array( $decoded ) ? normalize_value( $decoded ) : null;
}

function header_snapshot( $headers ) {
\tif ( ! is_array( $headers ) ) {
\t\treturn $headers;
\t}
\treturn array_values( array_map( 'trim', normalize_value( $headers ) ) );
}

function snoopy_snapshot( $snoopy ) {
\t$base_port = (int) parse_url( $GLOBALS['wphx_base_url'], PHP_URL_PORT );
\t$port = ( '127.0.0.1' === $snoopy->host && (int) $snoopy->port === $base_port ) ? 'PORT' : $snoopy->port;
\treturn normalize_value(
\t\tarray(
\t\t\t'host' => $snoopy->host,
\t\t\t'port' => $port,
\t\t\t'proxy_host' => $snoopy->proxy_host,
\t\t\t'proxy_port' => $snoopy->proxy_port,
\t\t\t'agent' => $snoopy->agent,
\t\t\t'referer' => $snoopy->referer,
\t\t\t'cookies' => $snoopy->cookies,
\t\t\t'rawheaders' => $snoopy->rawheaders,
\t\t\t'maxredirs' => $snoopy->maxredirs,
\t\t\t'lastredirectaddr' => $snoopy->lastredirectaddr,
\t\t\t'passcookies' => $snoopy->passcookies,
\t\t\t'results_type' => gettype( $snoopy->results ),
\t\t\t'results_sha256' => is_string( $snoopy->results ) ? 'sha256:' . hash( 'sha256', normalize_value( $snoopy->results ) ) : null,
\t\t\t'error' => $snoopy->error,
\t\t\t'response_code' => trim( $snoopy->response_code ),
\t\t\t'headers' => header_snapshot( $snoopy->headers ),
\t\t\t'maxlength' => $snoopy->maxlength,
\t\t\t'read_timeout' => $snoopy->read_timeout,
\t\t\t'timed_out' => $snoopy->timed_out,
\t\t\t'status' => is_int( $snoopy->status ) && 0 !== $snoopy->status ? 'nonzero' : $snoopy->status,
\t\t\t'_httpmethod' => $snoopy->_httpmethod,
\t\t\t'_httpversion' => $snoopy->_httpversion,
\t\t\t'_submit_method' => $snoopy->_submit_method,
\t\t\t'_submit_type' => $snoopy->_submit_type,
\t\t\t'_isproxy' => $snoopy->_isproxy,
\t\t\t'_fp_timeout' => $snoopy->_fp_timeout,
\t\t)
\t);
}

function new_snoopy() {
\t$snoopy = new Snoopy();
\t$snoopy->agent = 'Snoopy fixture agent';
\t$snoopy->accept = 'text/html, application/json';
\t$snoopy->referer = $GLOBALS['wphx_base_url'] . '/referer';
\t$snoopy->read_timeout = 0;
\treturn $snoopy;
}

function observe_snoopy( $id, $snoopy, $ok ) {
\treturn array(
\t\t'id' => $id,
\t\t'ok' => $ok,
\t\t'snapshot' => snoopy_snapshot( $snoopy ),
\t\t'decoded_result' => is_string( $snoopy->results ) ? decode_json_result( $snoopy->results ) : normalize_value( $snoopy->results ),
\t\t'raw_result' => normalize_value( $snoopy->results ),
\t);
}

require $root . '/wp-includes/class-snoopy.php';

$default_vars = get_class_vars( 'Snoopy' );
ksort( $default_vars );
$method_names = get_class_methods( 'Snoopy' );
sort( $method_names );
$observations = array(
\t'root' => $root,
\t'class_exists' => class_exists( 'Snoopy', false ),
\t'deprecated_files' => $GLOBALS['wphx_deprecated_files'],
\t'default_public_fields' => normalize_value( $default_vars ),
\t'method_names' => $method_names,
\t'cases' => array(),
);

$snoopy = new_snoopy();
$snoopy->cookies = array( 'fixture' => 'cookie space' );
$snoopy->rawheaders = array( 'X-Snoopy-Fixture' => 'fetch' );
$ok = $snoopy->fetch( $base_url . '/inspect?case=fetch&item=one' );
$observations['cases']['fetch_http'] = observe_snoopy( 'fetch_http', $snoopy, $ok );

$snoopy = new_snoopy();
$snoopy->rawheaders = array( 'X-Snoopy-Fixture' => 'submit' );
$ok = $snoopy->submit(
\t$base_url . '/submit?case=submit',
\tarray( 'alpha' => 'one', 'multi' => array( 'two', 'three' ) )
);
$observations['cases']['submit_form'] = observe_snoopy( 'submit_form', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->fetchlinks( $base_url . '/html' );
$observations['cases']['fetchlinks'] = observe_snoopy( 'fetchlinks', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->fetchform( $base_url . '/form' );
$observations['cases']['fetchform'] = observe_snoopy( 'fetchform', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->fetchtext( $base_url . '/html' );
$observations['cases']['fetchtext'] = observe_snoopy( 'fetchtext', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->submitlinks( $base_url . '/html-post', array( 'posted' => 'links' ) );
$observations['cases']['submitlinks'] = observe_snoopy( 'submitlinks', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->submittext( $base_url . '/html-post', array( 'posted' => 'text' ) );
$observations['cases']['submittext'] = observe_snoopy( 'submittext', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->fetch( $base_url . '/redirect' );
$observations['cases']['redirect_cookie'] = observe_snoopy( 'redirect_cookie', $snoopy, $ok );

$helper = new_snoopy();
$helper->set_submit_normal();
$normal_body = $helper->_prepare_post_body(
\tarray( 'alpha' => 'one', 'multi' => array( 'two', 'three' ) ),
\tarray()
);
$upload = $root . '/upload-fixture.txt';
file_put_contents( $upload, "upload-body\\n" );
$helper->set_submit_multipart();
$multipart_body = $helper->_prepare_post_body(
\tarray( 'alpha' => 'one' ),
\tarray( 'upload' => $upload )
);
$observations['cases']['post_body_helpers'] = normalize_value(
\tarray(
\t\t'normal_body' => $normal_body,
\t\t'multipart_body' => $multipart_body,
\t\t'snapshot' => snoopy_snapshot( $helper ),
\t)
);

$fake_curl = $root . '/fake-curl.sh';
file_put_contents(
\t$fake_curl,
\t<<<'SH'
#!/bin/sh
headerfile=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-D' ]; then
    shift
    headerfile=$1
  fi
  shift
done
printf 'HTTP/1.0 200 OK\r\nX-Fake-Curl: yes\r\n\r\n' > "$headerfile"
printf '%s\n' '<html>Secure &amp; body</html>'
exit 0
SH
);
chmod( $fake_curl, 0700 );
$snoopy = new_snoopy();
$snoopy->curl_path = $fake_curl;
$ok = $snoopy->fetch( 'https://example.test/secure?case=https' );
$observations['cases']['https_fake_curl'] = observe_snoopy( 'https_fake_curl', $snoopy, $ok );

$snoopy = new_snoopy();
$ok = $snoopy->fetch( 'ftp://example.test/file' );
$observations['cases']['invalid_protocol'] = observe_snoopy( 'invalid_protocol', $snoopy, $ok );

$snoopy = new_snoopy();
$snoopy->_fp_timeout = 1;
$ok = $snoopy->fetch( 'http://127.0.0.1:1/unreachable' );
$observations['cases']['connect_failure'] = observe_snoopy( 'connect_failure', $snoopy, $ok );

$observations['captured_errors'] = $GLOBALS['wphx_errors'];

echo json_encode( normalize_value( $observations ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE ) . "\\n";
`
  );
}

function lintFile(path) {
  return command("php", ["-l", path]);
}

function runProbe(root, baseUrl) {
  const output = command("php", [PROBE, root, baseUrl]);
  return JSON.parse(output);
}

async function startServer() {
  writeServer();
  const child = spawn(process.execPath, [SERVER], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));
  const rl = createInterface({ input: child.stdout });
  const firstLine = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Snoopy loopback server did not start: ${stderr.join("")}`)), 5000);
    rl.once("line", (line) => {
      clearTimeout(timeout);
      resolve(line);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Snoopy loopback server exited with ${code}: ${stderr.join("")}`));
    });
  });
  const info = JSON.parse(firstLine);
  return {
    ...info,
    stop: () =>
      new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
        setTimeout(resolve, 1000);
      })
  };
}

function stripVolatile(observation) {
  const copy = JSON.parse(JSON.stringify(observation));
  delete copy.root;
  return copy;
}

function externalRefOf(manifest) {
  return manifest.issue?.external_ref ?? manifest.issue ?? manifest.task?.external_ref ?? manifest.task ?? null;
}

function unexpectedCapturedErrors(observation) {
  return observation.captured_errors.filter(
    (error) =>
      !(
        error.errno === 2 &&
        error.file === "class-snoopy.php" &&
        error.message === "fsockopen(): Unable to connect to 127.0.0.1:PORT (Connection refused)"
      )
  );
}

function scanCaller(path, pattern) {
  const text = readFileSync(upstreamPath(path), "utf8");
  const lines = text.split(/\r?\n/);
  return lines
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((entry) => pattern.test(entry.text));
}

async function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const httpGates = readJson(HTTP_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const magpieFetch = readJson(MAGPIE_FETCH);
  const xmlrpcSurface = readJson(XMLRPC_SURFACE);
  const snoopyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "snoopy");
  const snoopyGates = httpGates.gate_plan.filter((entry) => entry.boundary_id === "snoopy");
  const snoopyBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "snoopy");
  const legacyGate = snoopyGates.find((entry) => entry.id === "snoopy-legacy-api-fixture");
  const callerGate = snoopyGates.find((entry) => entry.id === "snoopy-caller-ecosystem-review");
  const provenanceGate = snoopyGates.find((entry) => entry.id === "snoopy-license-provenance-review");

  if (snoopyPlan?.followup_issue.external_ref !== "WPHX-323.02") failures.push("WPHX-323.01 Snoopy plan is not routed to WPHX-323.02");
  for (const gate of [legacyGate, callerGate, provenanceGate]) {
    if (gate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push(`${gate?.id ?? "missing Snoopy gate"} is not routed to WPHX-323.10`);
  }
  if (snoopyBoundary?.source_inventory.count !== 1) failures.push(`expected Snoopy source inventory count 1, found ${snoopyBoundary?.source_inventory.count}`);
  if (snoopyBoundary?.distribution_artifacts.count !== 1) failures.push(`expected Snoopy distribution artifact count 1, found ${snoopyBoundary?.distribution_artifacts.count}`);
  if (externalRefOf(magpieFetch) !== "WPHX-312.23") failures.push("WPHX-312.23 Magpie fetch/cache fixture is missing or malformed");
  if (externalRefOf(xmlrpcSurface) !== "WPHX-318.01") failures.push("WPHX-318.01 XML-RPC legacy/deprecated surface is missing or malformed");

  mirrorSource(ORACLE_ROOT);
  mirrorSource(CANDIDATE_ROOT);
  writeProbe();

  const linted = {
    oracle_lint: lintFile(mirrorPath(ORACLE_ROOT, SNOOPY_SOURCE)),
    candidate_lint: lintFile(mirrorPath(CANDIDATE_ROOT, SNOOPY_SOURCE))
  };

  const server = await startServer();
  let oracle;
  let candidate;
  try {
    oracle = runProbe(ORACLE_ROOT, server.baseUrl);
    candidate = runProbe(CANDIDATE_ROOT, server.baseUrl);
  } finally {
    await server.stop();
  }

  const comparableOracle = stripVolatile(oracle);
  const comparableCandidate = stripVolatile(candidate);
  const observationsEqual = JSON.stringify(comparableOracle) === JSON.stringify(comparableCandidate);
  if (!observationsEqual) failures.push("oracle and candidate Snoopy observations differ");
  const unexpectedErrors = [...unexpectedCapturedErrors(oracle), ...unexpectedCapturedErrors(candidate)];
  if (unexpectedErrors.length > 0) failures.push("Snoopy probe captured unexpected PHP warnings/notices");

  const missingMethods = REQUIRED_METHODS.filter((method) => !oracle.method_names.includes(method));
  if (missingMethods.length > 0) failures.push(`Snoopy methods missing from reflection snapshot: ${missingMethods.join(", ")}`);

  const caseIds = Object.keys(oracle.cases).sort();
  if (caseIds.length !== 12) failures.push(`expected 12 Snoopy observation cases, found ${caseIds.length}`);
  if (oracle.cases.fetch_http.decoded_result?.method !== "GET") failures.push("fetch_http did not record a GET request");
  if (oracle.cases.submit_form.decoded_result?.method !== "POST") failures.push("submit_form did not record a POST request");
  if (oracle.cases.redirect_cookie.decoded_result?.headers?.cookie !== "legacy=jar") failures.push("redirect_cookie did not pass the Set-Cookie value into the redirected request");
  if (oracle.cases.invalid_protocol.ok !== false) failures.push("invalid_protocol did not fail as expected");
  if (oracle.cases.connect_failure.ok !== false) failures.push("connect_failure did not fail as expected");
  if (oracle.cases.https_fake_curl.snapshot.headers?.includes("X-Fake-Curl: yes") !== true) failures.push("https_fake_curl did not execute the fake curl _httpsrequest path");

  const callerReview = {
    magpie_fetch_cache_manifest: fileRecord(MAGPIE_FETCH),
    xmlrpc_legacy_surface_manifest: fileRecord(XMLRPC_SURFACE),
    source_scans: [
      {
        path: "src/wp-includes/rss.php",
        role: "MagpieRSS keeps Snoopy-compatible response shapes around _fetch_remote_file.",
        matches: scanCaller("src/wp-includes/rss.php", /Snoopy|_fetch_remote_file/)
      },
      {
        path: "src/wp-includes/class-wp-xmlrpc-server.php",
        role: "XML-RPC server source has no direct Snoopy class dependency in WordPress 7.0.",
        matches: scanCaller("src/wp-includes/class-wp-xmlrpc-server.php", /Snoopy|class-snoopy/)
      },
      {
        path: "src/wp-includes/deprecated.php",
        role: "Deprecated API source has no direct Snoopy class dependency in WordPress 7.0.",
        matches: scanCaller("src/wp-includes/deprecated.php", /Snoopy|class-snoopy/)
      }
    ],
    decision: "renew_preserved_artifact_exception",
    replacement_trigger:
      "Require concrete plugin/ecosystem pressure plus a generated wrapper or Haxe-owned replacement that preserves public fields, methods, request/response quirks, fake-curl/https path shape, cookie redirect behavior, and MagpieRSS Snoopy-compatible response expectations."
  };

  const headerText = readFileSync(upstreamPath(SNOOPY_SOURCE), "utf8").slice(0, 2200);
  const provenanceReview = {
    source_header_sha256: sha256(headerText),
    header_markers: {
      deprecated_wp_http_notice: headerText.includes("Deprecated. Use WP_HTTP"),
      author: headerText.includes("Monte Ohrt"),
      version: headerText.includes("Version: 1.2.4"),
      lgpl: /GNU Lesser General Public\s+\*\s+License/.test(headerText),
      sourceforge_url: headerText.includes("snoopy.sourceforge.net")
    },
    preserved_exception_renewed: true,
    distribution_divergence_claimed: false,
    replacement_safety_decision:
      "Preservation is safer for this deprecated compatibility file until ecosystem pressure justifies a generated wrapper or replacement with matching legacy property and method behavior."
  };

  const validationResult = {
    snoopy_source_inventory_count: snoopyBoundary.source_inventory.count,
    snoopy_distribution_artifact_count: snoopyBoundary.distribution_artifacts.count,
    required_method_count: REQUIRED_METHODS.length,
    observed_method_count: REQUIRED_METHODS.length - missingMethods.length,
    fixture_case_count: FIXTURE_CASES.length,
    observation_case_count: caseIds.length,
    caller_review_source_count: callerReview.source_scans.length,
    caller_review_match_count: callerReview.source_scans.reduce((sum, entry) => sum + entry.matches.length, 0),
    header_marker_count: Object.values(provenanceReview.header_markers).filter(Boolean).length,
    observations_equal: observationsEqual,
    captured_error_count: oracle.captured_errors.length + candidate.captured_errors.length,
    expected_connect_warning_count:
      oracle.captured_errors.length + candidate.captured_errors.length - unexpectedErrors.length,
    unexpected_captured_error_count: unexpectedErrors.length,
    remaining_gap_count: REMAINING_GAPS.length
  };

  if (!Object.values(provenanceReview.header_markers).every(Boolean)) failures.push("Snoopy provenance header markers are incomplete");
  if (failures.length > 0) {
    throw new Error(`WPHX-323.10 Snoopy legacy exception gate failed:\n- ${failures.join("\n- ")}`);
  }

  const manifest = {
    schema: "wphx.wp-core-snoopy-legacy-exception-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      boundary_id: "snoopy",
      source_path: snoopyBoundary.source_path,
      distribution_path: snoopyBoundary.distribution_path,
      evidence_lane: "preserved_snoopy_legacy_api_and_exception_renewal",
      replacement_strategy: snoopyPlan.replacement_strategy,
      candidate_strategy: "copied_preserved_upstream_snoopy_fallback_only",
      renewed_preserved_artifact_exception_claimed: true,
      haxe_owned_snoopy_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_snoopy_retirement_claimed: false,
      installed_wordpress_behavior_claimed: false
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      http_vendor_gate_manifest: fileRecord(HTTP_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_file: sourceRecord(SNOOPY_SOURCE),
      magpie_fetch_cache_manifest: fileRecord(MAGPIE_FETCH),
      xmlrpc_legacy_surface_manifest: fileRecord(XMLRPC_SURFACE)
    },
    fixture_cases: FIXTURE_CASES,
    local_loopback_server: {
      generated_server: SERVER,
      host: "127.0.0.1",
      protocol: "http",
      endpoints: ["/inspect", "/submit", "/html", "/html-post", "/form", "/redirect", "/final"],
      network_scope: "local loopback only"
    },
    mirror_roots: {
      oracle: ORACLE_ROOT,
      candidate: CANDIDATE_ROOT,
      note: "Both roots are regenerated from preserved upstream WordPress 7.0 class-snoopy.php. The candidate root is the preserved exception artifact, not a replacement."
    },
    linted_file: linted,
    required_methods: REQUIRED_METHODS,
    observations: {
      oracle,
      candidate,
      comparable_sha256: {
        oracle: sha256(JSON.stringify(comparableOracle)),
        candidate: sha256(JSON.stringify(comparableCandidate))
      }
    },
    caller_ecosystem_review: callerReview,
    license_provenance_review: provenanceReview,
    renewed_exception_policy: {
      decision: "renew_preserved_artifact_exception",
      reason:
        "Snoopy is deprecated WordPress compatibility code with a narrow upstream file, visible public properties/method quirks, and MagpieRSS Snoopy-compatible response expectations; the repo records no replacement pressure strong enough to make a generated wrapper safer yet.",
      fallback_policy:
        "Keep upstream class-snoopy.php preserved unless plugin/ecosystem evidence plus generated wrapper or Haxe-owned implementation evidence proves a safer replacement path.",
      removal_gate:
        "Do not retire class-snoopy.php or cite Snoopy implementation ownership until replacement pressure, generated public PHP evidence, legacy API parity, MagpieRSS compatibility, provenance review, and ecosystem gates pass."
    },
    remaining_gaps: REMAINING_GAPS,
    validation_result: validationResult,
    claims: [
      "The preserved upstream WordPress 7.0 class-snoopy.php file is mirrored into deterministic oracle and candidate fallback roots and PHP-linted.",
      "Oracle and candidate fallback roots produce matching legacy Snoopy observations for reflection/defaults, fetch, submit, fetchlinks, fetchform, fetchtext, submitlinks, submittext, redirect cookies, post body helpers, fake-curl HTTPS path, invalid protocol, and connect failure behavior.",
      "The caller/provenance review renews Snoopy as a preserved artifact exception unless future ecosystem pressure justifies a generated wrapper or Haxe-owned replacement."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned Snoopy runtime logic.",
      "This gate does not generate or validate a public PHP replacement for class-snoopy.php.",
      "This gate does not retire the copied upstream Snoopy artifact.",
      "The candidate root is the preserved upstream fallback and must not be cited as installed WordPress behavior parity or distribution divergence evidence.",
      "Real timeout, real HTTPS curl/TLS/proxy behavior, and broad plugin ecosystem usage remain future evidence."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    artifact: OUT,
    ownership_state: "preserved_upstream_snoopy_legacy_exception_gate",
    boundary_id: "snoopy",
    source_authority: "../wordpress-develop WordPress 7.0 class-snoopy.php",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    legacy_api_fixture_claimed: true,
    renewed_preserved_artifact_exception_claimed: true,
    installed_wordpress_behavior_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_runtime_claimed: false,
    copied_upstream_php_executed: true,
    copied_snoopy_retirement_claimed: false,
    removal_gate: manifest.renewed_exception_policy.removal_gate,
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-10-snoopy-legacy-exception-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_snoopy_legacy_exception_gate",
    artifact_scope: "wordpress-7.0-preserved-class-snoopy",
    commands: ["npm run wp:core:wphx-323-snoopy-legacy-exception", "npm run wp:core:wphx-323-snoopy-legacy-exception:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_http_vendor_gate_manifest: HTTP_GATES,
      vendor_closure_manifest: VENDOR_CLOSURE
    },
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const verb = checkOnly ? "validated" : "wrote";
  console.log(`${verb} ${OUT}`);
  console.log(`${verb} ${OWNERSHIP}`);
  console.log(`${verb} ${RECEIPT}`);
  console.log(`recorded ${caseIds.length} Snoopy legacy observations and renewed the preserved exception`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
