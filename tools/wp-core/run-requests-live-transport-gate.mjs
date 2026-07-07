#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l5yn",
  external_ref: "WPHX-323.09",
  title: "Add Requests live transport replacement parity gate"
};
const RECORDED_AT = "2026-07-07T16:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-requests-live-transport-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-09";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const SERVER = `${OUT_ROOT}/requests-loopback-server.mjs`;
const PROBE = `${OUT_ROOT}/requests-live-transport-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const HTTP_GATES = "manifests/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json";
const API_REFLECTION = "manifests/wp-core/wphx-323-08-requests-api-reflection-fixture.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-09-requests-live-transport-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-09-requests-live-transport-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-09-requests-live-transport-gate.v1.json";

const REQUESTS_ROOT = "src/wp-includes/Requests";
const REQUESTS_SHIM = "src/wp-includes/class-requests.php";
const CASES = [
  { id: "requests-live:get-query-headers", focus: "GET query string, request headers, repeated response headers, and response JSON body" },
  { id: "requests-live:head", focus: "HEAD request response status and headers without body" },
  { id: "requests-live:post-form", focus: "POST form-array body handoff and server-observed method/body shape" },
  { id: "requests-live:put-raw", focus: "PUT raw body and content-type handoff" },
  { id: "requests-live:redirect-cookie", focus: "redirect following, Set-Cookie capture, and cookie jar mutation" },
  { id: "requests-live:max-bytes", focus: "response byte limit truncates local response body deterministically" },
  { id: "requests-live:http-status-exception", focus: "non-success HTTP status response plus throw_for_status exception shape" },
  { id: "requests-live:nonblocking", focus: "blocking=false transport response shape through local loopback" },
  { id: "requests-live:invalid-url-error", focus: "invalid URL error shape before network I/O" }
];
const REMAINING_TRANSPORT_GAPS = [
  {
    id: "tls-verification",
    status: "blocked",
    reason: "This gate uses deterministic HTTP loopback only. TLS certificate validation, certificate failure, and CA bundle behavior require a controlled HTTPS server and certificate fixture before replacement claims."
  },
  {
    id: "proxy-negotiation",
    status: "blocked",
    reason: "This gate records proxy replacement requirements but does not run an HTTP proxy server. Proxy auth, CONNECT, bypass, and proxy failure behavior remain future WPHX-323.09 follow-up evidence before Requests retirement."
  },
  {
    id: "dns-failure",
    status: "blocked",
    reason: "DNS failure is intentionally not exercised against external names. Future replacement work must add recorded or sandboxed DNS failure evidence."
  },
  {
    id: "host-primitive-replacement",
    status: "blocked",
    reason: "The candidate path is still the preserved upstream Requests fallback package. No Haxe-owned or host-primitive-backed replacement implementation is executed by this gate."
  },
  {
    id: "wp-http-installed-wrapper",
    status: "blocked",
    reason: "This gate executes direct Requests package entry points. Full WP_Http installed wrapper behavior remains covered only by prior deterministic WPHX-312 gates until an installed WordPress loopback package gate exists."
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

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
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

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(mirrorPath(root, REQUESTS_ROOT), { recursive: true });
  cpSync(upstreamPath(REQUESTS_ROOT), mirrorPath(root, REQUESTS_ROOT), { recursive: true });
  mkdirSync(dirname(mirrorPath(root, REQUESTS_SHIM)), { recursive: true });
  copyFileSync(upstreamPath(REQUESTS_SHIM), mirrorPath(root, REQUESTS_SHIM));
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

function sendJson(response, status, payload, headers = {}) {
  response.sendDate = false;
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers
  });
  if (response.req.method !== "HEAD") response.end(JSON.stringify(payload));
  else response.end();
}

const server = createServer(async (request, response) => {
  response.sendDate = false;
  const url = new URL(request.url, "http://127.0.0.1");
  const body = await readBody(request);
  if (url.pathname === "/inspect") {
    sendJson(
      response,
      200,
      {
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: request.headers,
        body,
        body_length: Buffer.byteLength(body)
      },
      { "X-Repeat": ["one", "two"], "X-Transport-Gate": "inspect" }
    );
    return;
  }
  if (url.pathname === "/head") {
    sendJson(response, 204, { method: request.method }, { "X-Head-Only": "yes" });
    return;
  }
  if (url.pathname === "/redirect") {
    response.writeHead(302, {
      Location: "/final",
      "Set-Cookie": "redir=1; Path=/",
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }
  if (url.pathname === "/final") {
    sendJson(response, 200, {
      method: request.method,
      path: url.pathname,
      cookie: request.headers.cookie || "",
      redirected: true
    });
    return;
  }
  if (url.pathname === "/large") {
    response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    response.end("abcdefghijklmnopqrstuvwxyz");
    return;
  }
  if (url.pathname === "/status/418") {
    sendJson(response, 418, { error: "teapot" }, { "X-Status": "teapot" });
    return;
  }
  sendJson(response, 404, { error: "not-found", path: url.pathname });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  console.log(JSON.stringify({ port: address.port }));
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');
$base_url = rtrim($argv[2], '/');

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

define('ABSPATH', $root . '/');
define('WPINC', 'wp-includes');
define('REQUESTS_SILENCE_PSR0_DEPRECATIONS', true);

require ABSPATH . WPINC . '/Requests/src/Autoload.php';
WpOrg\\Requests\\Autoload::register();
require ABSPATH . WPINC . '/class-requests.php';

$captured_errors = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => str_replace($root . '/', '', str_replace('\\\\', '/', $errfile)),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function wphx_headers($headers) {
\tif (is_object($headers) && method_exists($headers, 'getAll')) {
\t\t$out = wphx_normalize_value($headers->getAll());
\t\tksort($out);
\t\treturn $out;
\t}
\tif (is_array($headers)) {
\t\t$out = wphx_normalize_value($headers);
\t\tksort($out);
\t\treturn $out;
\t}
\treturn array();
}

function wphx_normalize_value($value, $key = null) {
\tif (is_string($value)) {
\t\treturn preg_replace('/127\\\\.0\\\\.0\\\\.1:\\\\d+/', '127.0.0.1:<port>', $value);
\t}
\tif (is_array($value)) {
\t\t$out = array();
\t\tforeach ($value as $child_key => $child_value) {
\t\t\tif ('creation' === $child_key || 'last-access' === $child_key) {
\t\t\t\t$out[$child_key] = '<time>';
\t\t\t} else {
\t\t\t\t$out[$child_key] = wphx_normalize_value($child_value, $child_key);
\t\t\t}
\t\t}
\t\treturn $out;
\t}
\treturn $value;
}

function wphx_cookies($cookies) {
\t$out = array();
\tforeach ($cookies as $key => $cookie) {
\t\t$out[] = array(
\t\t\t'key' => is_int($key) ? null : (string) $key,
\t\t\t'class' => is_object($cookie) ? get_class($cookie) : gettype($cookie),
\t\t\t'name' => $cookie->name ?? null,
\t\t\t'value' => $cookie->value ?? null,
\t\t\t'attributes' => wphx_normalize_value($cookie->attributes ?? array()),
\t\t\t'flags' => wphx_normalize_value($cookie->flags ?? array()),
\t\t);
\t}
\tusort($out, fn($a, $b) => strcmp((string) $a['name'], (string) $b['name']));
\treturn $out;
}

function wphx_response($response) {
\tif (is_array($response) && isset($response['__wphx_response'])) {
\t\treturn array(
\t\t\t'class' => 'WPHX_Composite_Response_Observation',
\t\t\t'response' => wphx_response($response['__wphx_response']),
\t\t\t'throw_for_status' => $response['throw_for_status'] ?? null,
\t\t);
\t}
\tif ($response instanceof WpOrg\\Requests\\Response) {
\t\t$body = wphx_normalize_value($response->body);
\t\t$json = wphx_normalize_value(json_decode($response->body, true));
\t\treturn array(
\t\t\t'class' => get_class($response),
\t\t\t'status_code' => $response->status_code,
\t\t\t'headers' => wphx_headers($response->headers),
\t\t\t'body' => $body,
\t\t\t'body_sha256' => 'sha256:' . hash('sha256', $body),
\t\t\t'body_json' => is_array($json) ? $json : null,
\t\t\t'cookies' => wphx_cookies($response->cookies),
\t\t);
\t}
\treturn array('class' => is_object($response) ? get_class($response) : gettype($response), 'value' => $response);
}

function wphx_throwable($throwable) {
\treturn array(
\t\t'class' => get_class($throwable),
\t\t'message' => $throwable->getMessage(),
\t\t'code' => $throwable->getCode(),
\t\t'type' => method_exists($throwable, 'getType') ? $throwable->getType() : null,
\t\t'data_class' => method_exists($throwable, 'getData') && is_object($throwable->getData()) ? get_class($throwable->getData()) : null,
\t);
}

function wphx_hook_log() {
\t$hooks = new WpOrg\\Requests\\Hooks();
\t$log = array();
\t$names = array(
\t\t'requests.before_request',
\t\t'requests.before_parse',
\t\t'requests.before_redirect_check',
\t\t'requests.before_redirect',
\t\t'requests.after_request',
\t\t'curl.before_request',
\t\t'curl.before_send',
\t\t'curl.after_send',
\t\t'curl.after_request',
\t\t'fsockopen.before_request',
\t\t'fsockopen.before_send',
\t\t'fsockopen.after_send',
\t\t'fsockopen.after_request',
\t\t'request.progress',
\t);
\tforeach ($names as $name) {
\t\t$hooks->register($name, function (...$args) use (&$log, $name) {
\t\t\t$log[] = array(
\t\t\t\t'hook' => $name,
\t\t\t\t'arg_count' => count($args),
\t\t\t\t'arg_types' => array_map(fn($arg) => is_object($arg) ? get_class($arg) : gettype($arg), $args),
\t\t\t);
\t\t});
\t}
\treturn array($hooks, &$log);
}

function wphx_request_case($transport, $id, $callback) {
\t[$hooks, $log] = wphx_hook_log();
\t$options = array('transport' => $transport, 'hooks' => $hooks, 'timeout' => 3);
\ttry {
\t\t$response = $callback($options);
\t\t$out = array('status' => 'ok', 'response' => wphx_response($response));
\t} catch (Throwable $throwable) {
\t\t$out = array('status' => 'threw', 'throwable' => wphx_throwable($throwable));
\t}
\t$out['hooks'] = $log;
\treturn $out;
}

function wphx_transport_available($class) {
\treturn class_exists($class) && $class::test(array());
}

$transport_classes = array(
\t'curl' => 'WpOrg\\\\Requests\\\\Transport\\\\Curl',
\t'fsockopen' => 'WpOrg\\\\Requests\\\\Transport\\\\Fsockopen',
);
$transport_capabilities = array();
$transports = array();
foreach ($transport_classes as $id => $class) {
\t$available = wphx_transport_available($class);
\t$transport_capabilities[$id] = array('class' => $class, 'available' => $available);
\tif ($available) {
\t\t$transports[$id] = $class;
\t}
}

$cases = array();
foreach ($transports as $transport_id => $transport_class) {
\t$cases[$transport_id] = array(
\t\t'get_query_headers' => wphx_request_case($transport_class, 'get_query_headers', fn($options) => WpOrg\\Requests\\Requests::get($base_url . '/inspect?alpha=1&beta=two', array('X-Client' => 'wphx'), $options)),
\t\t'head' => wphx_request_case($transport_class, 'head', fn($options) => WpOrg\\Requests\\Requests::head($base_url . '/head', array(), $options)),
\t\t'post_form' => wphx_request_case($transport_class, 'post_form', fn($options) => WpOrg\\Requests\\Requests::post($base_url . '/inspect', array('X-Form' => 'yes'), array('a' => '1', 'b' => 'two'), $options)),
\t\t'put_raw' => wphx_request_case($transport_class, 'put_raw', fn($options) => WpOrg\\Requests\\Requests::request($base_url . '/inspect', array('Content-Type' => 'text/plain'), 'raw-body', WpOrg\\Requests\\Requests::PUT, $options)),
\t\t'redirect_cookie' => wphx_request_case($transport_class, 'redirect_cookie', function ($options) use ($base_url) {
\t\t\t$options['cookies'] = new WpOrg\\Requests\\Cookie\\Jar();
\t\t\t$options['redirects'] = 3;
\t\t\treturn WpOrg\\Requests\\Requests::get($base_url . '/redirect', array(), $options);
\t\t}),
\t\t'max_bytes' => wphx_request_case($transport_class, 'max_bytes', function ($options) use ($base_url) {
\t\t\t$options['max_bytes'] = 7;
\t\t\treturn WpOrg\\Requests\\Requests::get($base_url . '/large', array(), $options);
\t\t}),
\t\t'http_status_exception' => wphx_request_case($transport_class, 'http_status_exception', function ($options) use ($base_url) {
\t\t\t$response = WpOrg\\Requests\\Requests::get($base_url . '/status/418', array(), $options);
\t\t\t$throw_for_status = null;
\t\t\ttry {
\t\t\t\t$response->throw_for_status(false);
\t\t\t} catch (Throwable $throwable) {
\t\t\t\t$throw_for_status = wphx_throwable($throwable);
\t\t\t}
\t\t\treturn array('__wphx_response' => $response, 'throw_for_status' => $throw_for_status);
\t\t}),
\t\t'nonblocking' => wphx_request_case($transport_class, 'nonblocking', function ($options) use ($base_url) {
\t\t\t$options['blocking'] = false;
\t\t\treturn WpOrg\\Requests\\Requests::get($base_url . '/inspect?nonblocking=1', array(), $options);
\t\t}),
\t);
}

$invalid_url = array();
foreach ($transports as $transport_id => $transport_class) {
\t$invalid_url[$transport_id] = wphx_request_case($transport_class, 'invalid_url', fn($options) => WpOrg\\Requests\\Requests::get('http://', array(), $options));
}

$result = array(
\t'root' => basename($root),
\t'base_url_host' => parse_url($base_url, PHP_URL_HOST),
\t'transport_capabilities' => $transport_capabilities,
\t'cases' => $cases,
\t'invalid_url' => $invalid_url,
\t'captured_errors' => $captured_errors,
);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`
  );
}

async function startServer() {
  writeServer();
  const child = spawn(process.execPath, [SERVER], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));
  const rl = createInterface({ input: child.stdout });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for loopback server. stderr=${stderr.join("")}`)), 5000);
    child.on("exit", (code) => reject(new Error(`Loopback server exited before ready with code ${code}. stderr=${stderr.join("")}`)));
    rl.on("line", (line) => {
      try {
        const payload = JSON.parse(line);
        clearTimeout(timer);
        resolve(payload);
      } catch {
        // Ignore non-JSON startup chatter.
      }
    });
  });
  return {
    baseUrl: `http://127.0.0.1:${ready.port}`,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  };
}

function runProbe(root, baseUrl) {
  const output = command("php", [PROBE, root, baseUrl]);
  return JSON.parse(output);
}

function lintFile(path) {
  return command("php", ["-l", path]);
}

function stripVolatile(observation) {
  const copy = JSON.parse(JSON.stringify(observation));
  delete copy.root;
  return copy;
}

async function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const httpGates = readJson(HTTP_GATES);
  const apiReflection = readJson(API_REFLECTION);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const requestsPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "requests");
  const liveGate = httpGates.gate_plan.find((entry) => entry.id === "requests-live-transport-matrix");
  const requestsBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "requests");
  const sourceFiles = listFiles(REQUESTS_ROOT).filter((path) => path.endsWith(".php"));

  if (requestsPlan?.followup_issue.external_ref !== "WPHX-323.02") failures.push("WPHX-323.01 Requests plan is not routed to WPHX-323.02");
  if (liveGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.02 live transport gate is not routed to WPHX-323.09");
  if (apiReflection.issue.external_ref !== "WPHX-323.08") failures.push("WPHX-323.08 Requests API/reflection fixture is missing or malformed");
  if (requestsBoundary?.source_inventory.count !== 65) failures.push(`expected Requests source inventory count 65, found ${requestsBoundary?.source_inventory.count}`);
  if (sourceFiles.length !== 65) failures.push(`expected 65 upstream Requests PHP files, found ${sourceFiles.length}`);

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const linted = [...sourceFiles, REQUESTS_SHIM].map((path) => ({
    path,
    oracle_lint: lintFile(mirrorPath(ORACLE_ROOT, path)),
    candidate_lint: lintFile(mirrorPath(CANDIDATE_ROOT, path))
  }));

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
  if (!observationsEqual) failures.push("oracle and candidate live Requests transport observations differ");
  if (oracle.captured_errors.length > 0 || candidate.captured_errors.length > 0) failures.push("Requests live transport probe captured PHP warnings/notices");

  const availableTransportIds = Object.entries(oracle.transport_capabilities)
    .filter(([, capability]) => capability.available)
    .map(([id]) => id)
    .sort();
  if (availableTransportIds.length === 0) failures.push("no Requests transports are available in the local PHP host");

  const caseCount = availableTransportIds.reduce((sum, id) => sum + Object.keys(oracle.cases[id] ?? {}).length, 0);
  const invalidUrlCaseCount = Object.keys(oracle.invalid_url).length;

  if (failures.length > 0) {
    throw new Error(`WPHX-323.09 Requests live transport gate failed:\n- ${failures.join("\n- ")}`);
  }

  const validationResult = {
    requests_source_inventory_count: requestsBoundary.source_inventory.count,
    requests_distribution_artifact_count: requestsBoundary.distribution_artifacts.count,
    upstream_requests_php_file_count: sourceFiles.length,
    available_transport_ids: availableTransportIds,
    available_transport_count: availableTransportIds.length,
    transport_case_count: caseCount,
    invalid_url_case_count: invalidUrlCaseCount,
    fixture_case_count: CASES.length,
    linted_file_count: linted.length,
    observations_equal: observationsEqual,
    captured_error_count: oracle.captured_errors.length + candidate.captured_errors.length,
    remaining_transport_gap_count: REMAINING_TRANSPORT_GAPS.length
  };

  const manifest = {
    schema: "wphx.wp-core-requests-live-transport-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      boundary_id: "requests",
      source_path: requestsBoundary.source_path,
      distribution_path: requestsBoundary.distribution_path,
      replacement_strategy: requestsPlan.replacement_strategy,
      evidence_lane: "preserved_upstream_requests_loopback_transport_baseline",
      candidate_strategy: "copied_preserved_upstream_requests_fallback_only",
      haxe_owned_requests_runtime_claimed: false,
      host_primitive_replacement_claimed: false,
      generated_public_wrapper_claimed: false,
      copied_requests_retirement_claimed: false,
      installed_wp_http_wrapper_claimed: false
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      http_vendor_gate_manifest: fileRecord(HTTP_GATES),
      requests_api_reflection_manifest: fileRecord(API_REFLECTION),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_files: sourceFiles.map(sourceRecord),
      support_files: [sourceRecord(REQUESTS_SHIM)]
    },
    fixture_cases: CASES,
    local_loopback_server: {
      generated_server: SERVER,
      host: "127.0.0.1",
      protocol: "http",
      endpoints: ["/inspect", "/head", "/redirect", "/final", "/large", "/status/418"],
      deterministic_headers: ["X-Repeat", "X-Transport-Gate", "X-Head-Only", "X-Status"],
      network_scope: "local loopback only"
    },
    mirror_roots: {
      oracle: ORACLE_ROOT,
      candidate: CANDIDATE_ROOT,
      note: "Both roots are regenerated from the preserved upstream WordPress 7.0 Requests package. The candidate root is the preserved fallback, not a host-primitive replacement."
    },
    linted_files: linted,
    observations: {
      oracle,
      candidate,
      comparable_sha256: {
        oracle: sha256(JSON.stringify(comparableOracle)),
        candidate: sha256(JSON.stringify(comparableCandidate))
      }
    },
    fallback_matrix: [
      {
        condition: "host transport unavailable or divergent",
        required_behavior: "Preserved upstream Requests remains runtime fallback."
      },
      {
        condition: "TLS/proxy/DNS behavior unmodeled",
        required_behavior: "Do not route those cases to a host-primitive replacement until dedicated gates pass."
      },
      {
        condition: "generated wrapper or overlay differs from upstream package",
        required_behavior: "Require WPHX-323.08 API/reflection compatibility plus overlay manifest before divergence."
      }
    ],
    remaining_transport_gaps: REMAINING_TRANSPORT_GAPS,
    validation_result: validationResult,
    removal_gates: [
      "Do not claim host-primitive-backed Requests replacement until this loopback baseline is repeated against the replacement candidate and remaining TLS/proxy/DNS gaps have dedicated evidence.",
      "Do not claim installed WP_Http live transport parity from this direct Requests package gate.",
      "Do not retire copied Requests artifacts until API/reflection, generated-wrapper shape, license/provenance, loopback transport, TLS/proxy/DNS, and installed wrapper gates pass."
    ],
    claims: [
      "The preserved upstream WordPress 7.0 Requests package executes deterministic local loopback HTTP transport cases in regenerated oracle and candidate fallback roots.",
      "Available local Requests transports produce matching oracle/candidate observations for direct Requests GET, HEAD, POST, PUT, redirect/cookie, max_bytes, HTTP status exception, nonblocking, and invalid URL cases.",
      "This gate records the fallback matrix and remaining transport gaps required before a host-primitive-backed Requests replacement can retire copied artifacts."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned or host-primitive-backed Requests runtime logic.",
      "This gate does not execute TLS certificate verification, proxy negotiation, DNS failure, external network, or installed WordPress WP_Http wrapper behavior.",
      "This gate does not generate or validate public PHP wrappers.",
      "The candidate root is the preserved upstream Requests fallback package and must not be cited as copied artifact retirement."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    artifact: OUT,
    ownership_state: "preserved_upstream_requests_loopback_transport_gate",
    boundary_id: "requests",
    source_authority: "../wordpress-develop WordPress 7.0 Requests package",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    live_loopback_transport_baseline_claimed: true,
    installed_wordpress_behavior_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_runtime_claimed: false,
    host_primitive_replacement_claimed: false,
    copied_upstream_php_executed: true,
    removal_gate:
      "Replace this preserved-package loopback baseline with host-primitive replacement evidence only after replacement candidate execution, TLS/proxy/DNS gates, generated overlay manifests, wrapper-shape receipts, and installed WP_Http wrapper parity pass.",
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-09-requests-live-transport-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_requests_loopback_transport_gate",
    artifact_scope: "wordpress-7.0-preserved-requests-package",
    commands: ["npm run wp:core:wphx-323-requests-live-transport", "npm run wp:core:wphx-323-requests-live-transport:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_http_vendor_gate_manifest: HTTP_GATES,
      requests_api_reflection_manifest: API_REFLECTION
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
  console.log(`recorded ${caseCount + invalidUrlCaseCount} loopback transport observations across ${availableTransportIds.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
