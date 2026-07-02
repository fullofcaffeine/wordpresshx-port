#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createConnection, createServer } from "node:net";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.39",
  external_ref: "WPHX-312.93",
  title: "WPHX-312.93 - Add real cron and mail transport installed gate"
};
const RECORDED_AT = "2026-07-02T23:30:00Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const BUILD_ROOT = "build/wp-core/wphx-312-93";
const ORACLE_ROOT = `${BUILD_ROOT}/oracle-package`;
const CANDIDATE_ROOT = `${BUILD_ROOT}/candidate-package`;
const ROUTER = "wphx-cron-mail-transport-installed-router.php";
const RUNNER = "tools/wp-core/run-wphx-312-cron-mail-transport-installed-gate.mjs";
const OUT = "manifests/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-93-cron-mail-transport-installed-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json";
const PRIOR_INPUTS = [
  "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json",
  "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-312-03-http-cron-mail-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-09-http-mail-feed-embed-installed-gate.v1.json",
  "manifests/wp-core/wphx-312-12-cron-dispatch-lock-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-13-phpmailer-setup-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-92-http-transport-parity-gate.v1.json"
];
const SOURCE_FILES = [
  "src/wp-includes/cron.php",
  "src/wp-cron.php",
  "src/wp-includes/pluggable.php",
  "src/wp-includes/class-wp-phpmailer.php",
  "src/wp-includes/PHPMailer/PHPMailer.php",
  "src/wp-includes/PHPMailer/SMTP.php",
  "src/wp-includes/PHPMailer/Exception.php"
];
const CASES = [
  { id: "boundary:cron-mail-transport-package", method: "GET", path: "/__wphx/package-boundary", focus: "selected WPHX-312 cron/mail source files and prior evidence inputs are present" },
  { id: "cron:controlled-loopback-success", method: "POST", path: "/__wphx/cron-success", focus: "spawn_cron sets the lock and sends a real controlled HTTP POST to the local cron capture server" },
  { id: "cron:lock-held-suppresses-spawn", method: "POST", path: "/__wphx/cron-lock-held", focus: "spawn_cron observes the lock timeout rule and does not issue a loopback request while a current lock exists" },
  { id: "cron:loopback-failure", method: "POST", path: "/__wphx/cron-failure", focus: "spawn_cron records a controlled connection failure and keeps the spawned return value false" },
  { id: "mail:smtp-capture-success", method: "POST", path: "/__wphx/mail-smtp-success", focus: "wp_mail sends through PHPMailer SMTP to a local capture server and records envelope/data observations" },
  { id: "mail:smtp-capture-failure", method: "POST", path: "/__wphx/mail-smtp-failure", focus: "wp_mail records PHPMailer SMTP connection failure and wp_mail_failed action without external delivery" }
];

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

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function packagePath(root, path) {
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

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = packagePath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function packageFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else {
        files.push({
          path: `${root}/${relative(root, child).replaceAll("\\", "/")}`,
          bytes: statSync(child).size,
          sha256: sha256File(child)
        });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function writeRouter(root) {
  writeFileSync(
    `${root}/${ROUTER}`,
    `<?php
$path = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH );
$body = file_get_contents( 'php://input' );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'WEEK_IN_SECONDS', 604800 );
define( 'WP_CRON_LOCK_TIMEOUT', 60 );

$source_files = ${JSON.stringify(SOURCE_FILES.map((sourcePath) => sourcePath.replace(/^src\//, "")))};
$cron_capture_base = 'http://127.0.0.1:' . getenv( 'WPHX_312_93_CRON_PORT' );
$smtp_port = (int) getenv( 'WPHX_312_93_SMTP_PORT' );

function wphx_312_93_json( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/json; charset=UTF-8' );
\techo json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\treturn true;
}

function wphx_312_93_source_records( $source_files ) {
\t$records = array();
\tforeach ( $source_files as $file ) {
\t\t$file_path = __DIR__ . '/' . $file;
\t\t$records[] = array(
\t\t\t'path' => $file,
\t\t\t'exists' => is_readable( $file_path ),
\t\t\t'bytes' => is_readable( $file_path ) ? filesize( $file_path ) : 0,
\t\t\t'sha256' => is_readable( $file_path ) ? hash_file( 'sha256', $file_path ) : null,
\t\t);
\t}
\treturn $records;
}

function wphx_312_93_common_bootstrap() {
\t$GLOBALS['wp_filter'] = array();
\t$GLOBALS['wphx_312_93_actions'] = array();
\t$GLOBALS['wphx_312_93_filters'] = array();
\t$GLOBALS['wphx_312_93_errors'] = array();
\tset_error_handler(
\t\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t\t$GLOBALS['wphx_312_93_errors'][] = array(
\t\t\t\t'errno' => $errno,
\t\t\t\t'message' => wphx_312_93_normalize_local_ports( $errstr ),
\t\t\t\t'file' => basename( $errfile ),
\t\t\t\t'line' => $errline,
\t\t\t);
\t\t\treturn true;
\t\t}
\t);
}

function wphx_312_93_normalize_local_ports( $value ) {
\treturn preg_replace( '/127\\.0\\.0\\.1:\\d+/', '127.0.0.1:<port>', $value );
}

class WP_Error {
\tprivate $code;
\tprivate $message;
\tprivate $data;
\tpublic function __construct( $code = '', $message = '', $data = null ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t\t$this->data = $data;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
\tpublic function get_error_data() { return $this->data; }
\tpublic function merge_from( $error ) {}
}

function __( $text ) { return $text; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( 'callback' => $callback, 'accepted_args' => $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { return add_filter( $hook_name, $callback, $priority, $accepted_args ); }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_312_93_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record['callback'], array_slice( $callback_args, 0, $record['accepted_args'] ) );
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_312_93_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ), 'error_code' => isset( $args[0] ) && $args[0] instanceof WP_Error ? $args[0]->get_error_code() : null );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn;
\t}
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\tcall_user_func_array( $record['callback'], array_slice( $args, 0, $record['accepted_args'] ) );
\t\t}
\t}
}
function do_action_ref_array( $hook_name, $args ) { do_action( $hook_name, ...$args ); }

function wphx_312_93_cron_bootstrap( $capture_base ) {
\twphx_312_93_common_bootstrap();
\t$_SERVER['REQUEST_METHOD'] = 'GET';
\t$_SERVER['REQUEST_URI'] = '/fixture';
\t$_GET = array();
\t$GLOBALS['wphx_312_93_capture_base'] = $capture_base;
\t$GLOBALS['wphx_312_93_current_action'] = '';
\t$GLOBALS['wphx_312_93_transients'] = array();
\t$GLOBALS['wphx_312_93_transient_writes'] = array();
\t$GLOBALS['wphx_312_93_options'] = array( 'cron' => array( 'version' => 2 ) );
\t$GLOBALS['wphx_312_93_remote_posts'] = array();
}
function wphx_312_93_seed_cron() {
\t$GLOBALS['wphx_312_93_options']['cron'] = array(
\t\t1000 => array(
\t\t\t'wphx_transport_event' => array(
\t\t\t\tmd5( serialize( array( 'transport' ) ) ) => array( 'schedule' => false, 'args' => array( 'transport' ) ),
\t\t\t),
\t\t),
\t\t'version' => 2,
\t);
}
function site_url( $request_path = '' ) { return rtrim( $GLOBALS['wphx_312_93_capture_base'], '/' ) . '/' . ltrim( $request_path, '/' ); }
function wp_unslash( $value ) { return $value; }
function add_query_arg( $key, $value, $url ) { return $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . rawurlencode( $key ) . '=' . rawurlencode( $value ); }
function wp_ob_end_flush_all() {}
function wp_redirect( $location, $status = 302 ) { return true; }
function wp_raise_memory_limit( $context = 'admin' ) { return '128M'; }
function wp_using_ext_object_cache() { return true; }
function wp_cache_get( $key, $group = '', $force = false, &$found = null ) {
\t$found = isset( $GLOBALS['wphx_312_93_transients'][ $key ] );
\treturn $GLOBALS['wphx_312_93_transients'][ $key ] ?? false;
}
function get_option( $name, $default = false ) { return array_key_exists( $name, $GLOBALS['wphx_312_93_options'] ) ? $GLOBALS['wphx_312_93_options'][ $name ] : $default; }
function update_option( $name, $value, $autoload = null ) { $GLOBALS['wphx_312_93_options'][ $name ] = $value; return true; }
function get_transient( $name ) { return $GLOBALS['wphx_312_93_transients'][ $name ] ?? false; }
function set_transient( $name, $value, $expiration = 0 ) {
\t$GLOBALS['wphx_312_93_transients'][ $name ] = $value;
\t$GLOBALS['wphx_312_93_transient_writes'][] = array( 'op' => 'set', 'name' => $name, 'value' => wphx_312_93_normalize_lock( $value ), 'expiration' => $expiration );
\treturn true;
}
function delete_transient( $name ) {
\tunset( $GLOBALS['wphx_312_93_transients'][ $name ] );
\t$GLOBALS['wphx_312_93_transient_writes'][] = array( 'op' => 'delete', 'name' => $name );
\treturn true;
}
function wp_remote_post( $url, $args = array() ) {
\t$context = stream_context_create(
\t\tarray(
\t\t\t'http' => array(
\t\t\t\t'method' => 'POST',
\t\t\t\t'timeout' => 2,
\t\t\t\t'ignore_errors' => true,
\t\t\t\t'header' => "Content-Type: application/x-www-form-urlencoded\\r\\nX-WPHX-Cron: controlled-loopback\\r\\n",
\t\t\t\t'content' => 'blocking=' . ( empty( $args['blocking'] ) ? 'false' : 'true' ),
\t\t\t),
\t\t)
\t);
\t$started = microtime( true );
\t$response = @file_get_contents( $url, false, $context );
\t$elapsed_ms = (int) round( ( microtime( true ) - $started ) * 1000 );
\t$status = 0;
\tif ( isset( $http_response_header[0] ) && preg_match( '/\\s(\\d{3})\\s/', $http_response_header[0], $matches ) ) {
\t\t$status = (int) $matches[1];
\t}
\t$GLOBALS['wphx_312_93_remote_posts'][] = array(
\t\t'url' => wphx_312_93_normalize_local_ports( preg_replace( '/doing_wp_cron=[^&]+/', 'doing_wp_cron=normalized', $url ) ),
\t\t'args' => array( 'timeout' => $args['timeout'] ?? null, 'blocking' => $args['blocking'] ?? null, 'sslverify' => $args['sslverify'] ?? null ),
\t\t'status' => $status,
\t\t'elapsed_bucket' => $elapsed_ms < 250 ? 'under-250ms' : 'over-250ms',
\t\t'error' => false === $response,
\t);
\tif ( false === $response ) {
\t\treturn new WP_Error( 'http_request_failed', 'controlled loopback failure' );
\t}
\treturn array( 'response' => array( 'code' => $status, 'message' => 'Captured' ), 'body' => $response );
}
function did_action( $hook_name ) { return 'wp_loaded' === $hook_name ? 1 : 0; }
function doing_action( $hook_name ) { return $GLOBALS['wphx_312_93_current_action'] === $hook_name; }
function wphx_312_93_normalize_lock( $value ) {
\tif ( is_string( $value ) && preg_match( '/^\\d+\\.\\d+$/', $value ) ) {
\t\treturn 'normalized-lock';
\t}
\treturn $value;
}
function wphx_312_93_cron_result( $case, $result ) {
\treturn array(
\t\t'case' => $case,
\t\t'result' => $result,
\t\t'transient_writes' => $GLOBALS['wphx_312_93_transient_writes'],
\t\t'locks' => array_map( 'wphx_312_93_normalize_lock', $GLOBALS['wphx_312_93_transients'] ),
\t\t'remote_posts' => $GLOBALS['wphx_312_93_remote_posts'],
\t\t'actions' => $GLOBALS['wphx_312_93_actions'],
\t\t'filters' => $GLOBALS['wphx_312_93_filters'],
\t\t'php_errors' => $GLOBALS['wphx_312_93_errors'],
\t);
}

function wphx_312_93_mail_bootstrap() {
\twphx_312_93_common_bootstrap();
\trequire ABSPATH . WPINC . '/PHPMailer/Exception.php';
\trequire ABSPATH . WPINC . '/PHPMailer/SMTP.php';
\trequire ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
\trequire ABSPATH . WPINC . '/class-wp-phpmailer.php';
\trequire ABSPATH . WPINC . '/pluggable.php';
}
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : false; }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function network_home_url( $request_path = '' ) { return 'https://www.example.test' . $request_path; }
function get_bloginfo( $show = '' ) { return 'charset' === $show ? 'UTF-8' : 'WordPress'; }
function wphx_312_93_mail_result( $case, $result ) {
\treturn array(
\t\t'case' => $case,
\t\t'result' => $result,
\t\t'actions' => $GLOBALS['wphx_312_93_actions'],
\t\t'filters' => $GLOBALS['wphx_312_93_filters'],
\t\t'php_errors' => $GLOBALS['wphx_312_93_errors'],
\t);
}

switch ( $path ) {
\tcase '/__wphx/package-boundary':
\t\treturn wphx_312_93_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'boundary:cron-mail-transport-package',
\t\t\t\t'package_kind' => 'installed-style-cron-mail-transport-gate',
\t\t\t\t'source_files' => wphx_312_93_source_records( $source_files ),
\t\t\t\t'public_php_replacement_claimed' => false,
\t\t\t)
\t\t);
\tcase '/__wphx/cron-success':
\t\twphx_312_93_cron_bootstrap( $cron_capture_base );
\t\trequire ABSPATH . WPINC . '/cron.php';
\t\twphx_312_93_seed_cron();
\t\tadd_filter( 'cron_request', function ( $request ) { $request['args']['headers'] = array( 'X-WPHX-Fixture' => 'cron-transport' ); return $request; }, 10, 1 );
\t\treturn wphx_312_93_json( 200, wphx_312_93_cron_result( 'cron:controlled-loopback-success', array( 'spawned' => spawn_cron( 2000.25 ) ) ) );
\tcase '/__wphx/cron-lock-held':
\t\twphx_312_93_cron_bootstrap( $cron_capture_base );
\t\trequire ABSPATH . WPINC . '/cron.php';
\t\twphx_312_93_seed_cron();
\t\t$GLOBALS['wphx_312_93_transients']['doing_cron'] = 2000.0;
\t\treturn wphx_312_93_json( 200, wphx_312_93_cron_result( 'cron:lock-held-suppresses-spawn', array( 'spawned' => spawn_cron( 2000.25 ) ) ) );
\tcase '/__wphx/cron-failure':
\t\twphx_312_93_cron_bootstrap( 'http://127.0.0.1:1/wp-cron.php' );
\t\trequire ABSPATH . WPINC . '/cron.php';
\t\twphx_312_93_seed_cron();
\t\treturn wphx_312_93_json( 200, wphx_312_93_cron_result( 'cron:loopback-failure', array( 'spawned' => spawn_cron( 2000.25 ) ) ) );
\tcase '/__wphx/mail-smtp-success':
\t\twphx_312_93_mail_bootstrap();
\t\tadd_action( 'phpmailer_init', function ( $mailer ) use ( $smtp_port ) { $mailer->isSMTP(); $mailer->Host = '127.0.0.1'; $mailer->Port = $smtp_port; $mailer->SMTPAutoTLS = false; $mailer->SMTPAuth = false; $mailer->Timeout = 5; $mailer->SMTPDebug = 0; $mailer->addCustomHeader( 'X-WPHX-Transport', 'smtp-capture' ); }, 10, 1 );
\t\t$result = wp_mail( 'Capture User <capture@example.test>', 'SMTP Capture Success', 'Hello controlled SMTP transport.', "From: Sender <sender@example.test>\\r\\nX-WPHX-Case: success" );
\t\treturn wphx_312_93_json( 200, wphx_312_93_mail_result( 'mail:smtp-capture-success', $result ) );
\tcase '/__wphx/mail-smtp-failure':
\t\twphx_312_93_mail_bootstrap();
\t\tadd_action( 'phpmailer_init', function ( $mailer ) { $mailer->isSMTP(); $mailer->Host = '127.0.0.1'; $mailer->Port = 1; $mailer->SMTPAutoTLS = false; $mailer->SMTPAuth = false; $mailer->Timeout = 1; $mailer->SMTPDebug = 0; }, 10, 1 );
\t\t$result = wp_mail( 'Failure User <failure@example.test>', 'SMTP Capture Failure', 'This message should fail locally.', 'From: Sender <sender@example.test>' );
\t\treturn wphx_312_93_json( 200, wphx_312_93_mail_result( 'mail:smtp-capture-failure', $result ) );
}

return wphx_312_93_json( 404, array( 'case' => 'missing', 'path' => $path ) );
`
  );
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to reserve local port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) break;
    const ready = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await sleep(50);
  }
  throw new Error(`Server did not open 127.0.0.1:${port}`);
}

async function withPhpServer(root, env, callback) {
  const port = await freePort();
  const child = spawn("php", ["-S", `127.0.0.1:${port}`, ROUTER], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await waitForPort(port, child);
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    if (child.exitCode && child.exitCode !== 0 && !child.killed) {
      throw new Error(`PHP server failed for ${root}: ${stderr}`);
    }
  }
}

async function createCronCaptureServer() {
  const captures = [];
  const server = createHttpServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      captures.push({
        method: request.method,
        url: request.url.replace(/doing_wp_cron=[^&]+/, "doing_wp_cron=normalized"),
        headers: {
          "content-type": request.headers["content-type"] ?? null,
          "x-wphx-cron": request.headers["x-wphx-cron"] ?? null
        },
        body
      });
      response.writeHead(204, { "content-type": "text/plain" });
      response.end("");
    });
  });
  const port = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  return {
    port,
    captures,
    reset: () => {
      captures.length = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function createSmtpCaptureServer() {
  const captures = [];
  const server = createServer((socket) => {
    const state = { mailFrom: "", rcptTo: [], data: "", inData: false, buffer: "" };
    socket.setEncoding("utf8");
    socket.write("220 wphx.local ESMTP\r\n");
    socket.on("data", (chunk) => {
      state.buffer += chunk;
      while (state.buffer.includes("\n")) {
        const index = state.buffer.indexOf("\n");
        const rawLine = state.buffer.slice(0, index + 1);
        state.buffer = state.buffer.slice(index + 1);
        const line = rawLine.replace(/\r?\n$/, "");
        if (state.inData) {
          if (line === ".") {
            state.inData = false;
            captures.push({ mailFrom: state.mailFrom, rcptTo: [...state.rcptTo], data: state.data });
            socket.write("250 queued\r\n");
          } else {
            state.data += `${line}\n`;
          }
          continue;
        }
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-wphx.local\r\n250 OK\r\n");
        } else if (upper.startsWith("MAIL FROM:")) {
          state.mailFrom = line.slice("MAIL FROM:".length).trim();
          socket.write("250 sender ok\r\n");
        } else if (upper.startsWith("RCPT TO:")) {
          state.rcptTo.push(line.slice("RCPT TO:".length).trim());
          socket.write("250 recipient ok\r\n");
        } else if (upper === "DATA") {
          state.inData = true;
          socket.write("354 end with dot\r\n");
        } else if (upper === "RSET") {
          state.mailFrom = "";
          state.rcptTo = [];
          state.data = "";
          state.inData = false;
          socket.write("250 reset\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else {
          socket.write("250 ok\r\n");
        }
      }
    });
  });
  const port = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  return {
    port,
    captures,
    reset: () => {
      captures.length = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function normalizeSmtpData(data) {
  const header = (name) => {
    const match = data.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
    return match ? match[1].trim().replace(/\\"/g, '"') : null;
  };
  return {
    subject: header("Subject"),
    from: header("From"),
    to: header("To"),
    x_wphx_case: header("X-WPHX-Case"),
    x_wphx_transport: header("X-WPHX-Transport"),
    contains_body: data.includes("Hello controlled SMTP transport."),
    normalized_sha256: sha256(
      data
        .replace(/^Date:.*$/gim, "Date: <normalized>")
        .replace(/^Message-ID:.*$/gim, "Message-ID: <normalized>")
        .replace(/boundary="[^"]+"/g, 'boundary="<normalized>"')
        .replace(/b[0-9]+_[A-Za-z0-9._=-]+/g, "b<normalized>")
    )
  };
}

function normalizeSmtpCaptures(captures) {
  return captures.map((capture) => ({
    mail_from: capture.mailFrom,
    rcpt_to: capture.rcptTo,
    data: normalizeSmtpData(capture.data)
  }));
}

function normalizeCronCaptures(captures) {
  return captures.map((capture) => ({
    method: capture.method,
    url: capture.url,
    headers: capture.headers,
    body: capture.body
  }));
}

function normalizeHeaders(headers) {
  const selected = {};
  for (const name of ["content-type"]) {
    const value = headers.get(name);
    if (value !== null) selected[name] = value;
  }
  return selected;
}

async function requestCase(baseUrl, testCase) {
  const response = await fetch(`${baseUrl}${testCase.path}`, {
    method: testCase.method,
    headers: testCase.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : undefined,
    body: testCase.method === "POST" ? "fixture=1" : undefined
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { kind: "text", sha256: sha256(text) };
  }
  return {
    id: testCase.id,
    status: response.status,
    headers: normalizeHeaders(response.headers),
    body
  };
}

async function runPackage(root, cronCapture, smtpCapture) {
  return withPhpServer(
    root,
    {
      WPHX_312_93_CRON_PORT: String(cronCapture.port),
      WPHX_312_93_SMTP_PORT: String(smtpCapture.port)
    },
    async (baseUrl) => {
    const observations = {};
    for (const testCase of CASES) {
      cronCapture.reset();
      smtpCapture.reset();
      const response = await requestCase(baseUrl, testCase);
      await sleep(80);
      observations[testCase.id] = {
        response,
        cron_captures: normalizeCronCaptures(cronCapture.captures),
        smtp_captures: normalizeSmtpCaptures(smtpCapture.captures)
      };
    }
    return observations;
    }
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-cron-mail-transport-installed-gate`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/cron-mail-transport-installed-gate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "installed_style_cron_mail_transport_gate",
      name: "Cron controlled loopback and PHPMailer SMTP capture transport observations",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This gate executes copied WordPress 7.0 cron and wp_mail/PHPMailer source in package roots served by PHP's built-in server. It observes spawn_cron locks and controlled local HTTP loopback success/failure plus wp_mail delivery through a local SMTP capture server and controlled SMTP failure without claiming production cron timing races, external SMTP/PHP-mail delivery, installed database state, public PHP replacement, or whole-domain closure."
    },
    ownership_state: "installed_style_package_gate_with_copied_oracle_php",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-controlled-cron-mail-transport-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass production-style loopback cron, persistent option/transient/database state, real PHP mail/SMTP operational delivery, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership or complete installed behavior."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, BUILD_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-cron-mail-transport-installed-gate",
        "npm run wp:core:wphx-312-cron-mail-transport-installed-gate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-93-cron-mail-transport-installed-gate"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(BUILD_ROOT, { recursive: true, force: true });
const cronCapture = await createCronCaptureServer();
const smtpCapture = await createSmtpCaptureServer();

try {
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeRouter(ORACLE_ROOT);
  writeRouter(CANDIDATE_ROOT);

  const oracle = await runPackage(ORACLE_ROOT, cronCapture, smtpCapture);
  const candidate = await runPackage(CANDIDATE_ROOT, cronCapture, smtpCapture);
  const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);
  if (!observationsMatch) {
    console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
    process.exit(1);
  }

  const phpLint = SOURCE_FILES.map((sourcePath) => ({
    path: sourcePath,
    oracle_lint: command("php", ["-l", packagePath(ORACLE_ROOT, sourcePath)]),
    candidate_lint: command("php", ["-l", packagePath(CANDIDATE_ROOT, sourcePath)])
  }));
  const manifest = {
    schema: "wphx.wp-core-cron-mail-transport-installed-gate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_package_http", "candidate_package_http", "controlled_loopback_http", "controlled_smtp_capture"],
    artifact_scope: "installed_style_cron_mail_transport_gate",
    inputs: {
      prior_inputs: PRIOR_INPUTS.map(inputRecord),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      source_files: SOURCE_FILES,
      side_effect_policy: {
        controlled_loopback_http: true,
        controlled_smtp_transport: true,
        production_cron_timing_races: false,
        external_network_delivery: false,
        php_mail_transport: false,
        database_backed_writes: false
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        installed_wordpress_behavior_claimed: "focused installed-style local cron/mail transport gate only"
      }
    },
    build: {
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT,
      controlled_capture_ports_runtime_only: true,
      oracle_files: packageFiles(ORACLE_ROOT),
      candidate_files: packageFiles(CANDIDATE_ROOT),
      php_lint: phpLint
    },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate))
    },
    remaining_gaps: [
      {
        id: "production-cron-loopback-and-races-deferred",
        owner: ISSUE.external_ref,
        detail:
          "The gate performs local controlled HTTP loopback through a capture server and records lock/failure behavior. It does not claim production web-server loopback routing, process isolation, cache/database-backed locks, concurrent spawn races, timeout variance, alternate cron flushing, or operational scheduling."
      },
      {
        id: "external-mail-delivery-deferred",
        owner: ISSUE.external_ref,
        detail:
          "The gate sends through PHPMailer SMTP to a local capture server and records controlled SMTP connection failure. It does not claim PHP mail(), authenticated SMTP, TLS negotiation, DNS/MX behavior, remote server policy, bounces, retries, or operational delivery."
      },
      {
        id: "installed-database-state-deferred",
        owner: ISSUE.external_ref,
        detail:
          "The package roots execute copied WordPress source with deterministic hooks and in-memory state. Real cron option/transient storage, user/privacy request tables, recovery mail state, and plugin/theme side effects remain later installed-distribution gates."
      },
      {
        id: "public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail: "The gate compares copied oracle PHP package roots; generated original-path PHP replacement remains a later cross-domain gate."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      observations_match: observationsMatch,
      controlled_loopback_http_claimed: true,
      controlled_smtp_transport_claimed: true,
      production_cron_timing_claimed: false,
      external_mail_delivery_claimed: false,
      public_php_replacement_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-93-cron-mail-transport-installed-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WPHX-312 cron/mail controlled transport installed-style gate manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle cron/mail controlled transport boundary" },
      { path: RUNNER, role: "installed-style cron/mail transport gate generator and check-mode validator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-cron-mail-transport-installed-gate",
      "npm run wp:core:wphx-312-cron-mail-transport-installed-gate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
      "receipt:wphx-312-09-http-mail-feed-embed-installed-gate",
      "receipt:wphx-312-12-cron-dispatch-lock-oracle-fixture",
      "receipt:wphx-312-13-phpmailer-setup-oracle-fixture",
      "receipt:wphx-312-92-http-transport-parity-gate"
    ],
    validation_result: manifest.validation_result
  };

  try {
    writeOrCheck(OUT, manifestText);
    writeOrCheck(OWNERSHIP, JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n");
    writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
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
        fixture_cases: CASES.length,
        observations_match: observationsMatch
      },
      null,
      2
    )
  );
} finally {
  await cronCapture.close();
  await smtpCapture.close();
}
