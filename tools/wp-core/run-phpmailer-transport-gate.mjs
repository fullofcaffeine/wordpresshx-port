#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-m1u1",
  external_ref: "WPHX-323.12",
  title: "Add PHPMailer SMTP and phpmail transport gate"
};
const RECORDED_AT = "2026-07-07T22:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-phpmailer-transport-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-12";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/phpmailer-transport-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MAIL_GATES = "manifests/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json";
const API_REFLECTION = "manifests/wp-core/wphx-323-11-phpmailer-api-reflection-fixture.v1.json";
const SETUP_FIXTURE = "manifests/wp-core/wphx-312-13-phpmailer-setup-oracle-fixture.v1.json";
const TRANSPORT_FLOOR = "manifests/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-12-phpmailer-transport-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-12-phpmailer-transport-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-12-phpmailer-transport-gate.v1.json";

const PHPMAILER_ROOT = "src/wp-includes/PHPMailer";
const SUPPORT_FILES = [
  "src/wp-includes/pluggable.php",
  "src/wp-includes/class-phpmailer.php",
  "src/wp-includes/class-smtp.php",
  "src/wp-includes/class-pop3.php",
  "src/wp-includes/class-wp-phpmailer.php"
];
const CASES = [
  { id: "phpmailer-transport:smtp-success", focus: "wp_mail sends through PHPMailer SMTP to deterministic local capture with headers, charset filter, attachment, embedded image, and success hooks" },
  { id: "phpmailer-transport:smtp-failure", focus: "wp_mail surfaces controlled local SMTP connection failure through ErrorInfo and wp_mail_failed" },
  { id: "phpmailer-transport:phpmail-boundary", focus: "wp_mail/PHPMailer builds PHP mail() boundary MIME shape without invoking host mail delivery" },
  { id: "phpmailer-transport:blocked-host-conditions", focus: "authenticated SMTP, TLS, proxy, DNS/MX, bounce, retry, and operational delivery stay blocked before replacement claims" }
];
const COVERED_SYMBOLS = [
  "wp_mail",
  "PHPMailer\\PHPMailer\\PHPMailer::send",
  "PHPMailer\\PHPMailer\\PHPMailer::preSend",
  "PHPMailer\\PHPMailer\\PHPMailer::postSend",
  "PHPMailer\\PHPMailer\\PHPMailer::smtpSend",
  "PHPMailer\\PHPMailer\\PHPMailer::isSMTP",
  "PHPMailer\\PHPMailer\\PHPMailer::isMail",
  "PHPMailer\\PHPMailer\\PHPMailer::addAddress",
  "PHPMailer\\PHPMailer\\PHPMailer::addCC",
  "PHPMailer\\PHPMailer\\PHPMailer::addBCC",
  "PHPMailer\\PHPMailer\\PHPMailer::addReplyTo",
  "PHPMailer\\PHPMailer\\PHPMailer::addAttachment",
  "PHPMailer\\PHPMailer\\PHPMailer::addEmbeddedImage",
  "PHPMailer\\PHPMailer\\PHPMailer::addCustomHeader",
  "PHPMailer\\PHPMailer\\SMTP",
  "WP_PHPMailer",
  "phpmailer_init",
  "wp_mail_succeeded",
  "wp_mail_failed",
  "wp_mail_charset",
  "wp_mail_content_type",
  "wp_mail_embed_args"
];
const BLOCKED_CONDITIONS = [
  {
    id: "authenticated-smtp",
    status: "blocked",
    reason: "This fixture uses unauthenticated loopback SMTP. AUTH mechanisms, credential handling, SASL failures, and auth retry behavior require a dedicated local SMTP AUTH server gate."
  },
  {
    id: "tls-and-starttls",
    status: "blocked",
    reason: "The local capture server intentionally omits TLS and STARTTLS. Certificate validation, crypto policy, auto-TLS upgrades, and TLS failures remain preserved-upstream fallback territory."
  },
  {
    id: "proxy-and-dns-mx",
    status: "blocked",
    reason: "No proxy, DNS, MX, or external hostname lookup is performed. Replacement work must add sandboxed DNS/proxy evidence before broadening transport claims."
  },
  {
    id: "remote-server-policy",
    status: "blocked",
    reason: "SPF, DKIM, DMARC, relay policy, greylisting, throttling, bounces, retries, and recipient delivery are operational mail-system behavior and are not claimed by this deterministic fixture."
  },
  {
    id: "host-php-mail-delivery",
    status: "blocked",
    reason: "The phpmail case overrides PHPMailer::postSend() after preSend() so the host mail() function is not invoked. It records boundary MIME shape only, not host delivery."
  },
  {
    id: "generated-wrapper-runtime",
    status: "blocked",
    reason: "The candidate root remains copied upstream PHPMailer fallback code. No generated wrapper, Haxe-owned vendor runtime, or copied artifact retirement is executed by this gate."
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
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
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
  mkdirSync(mirrorPath(root, PHPMAILER_ROOT), { recursive: true });
  cpSync(upstreamPath(PHPMAILER_ROOT), mirrorPath(root, PHPMAILER_ROOT), { recursive: true });
  for (const path of SUPPORT_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2];
$smtp_port = (int) $argv[3];

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

$GLOBALS['wp_filter'] = array();
$GLOBALS['wphx_323_12_actions'] = array();
$GLOBALS['wphx_323_12_filters'] = array();
$GLOBALS['wphx_323_12_errors'] = array();
$GLOBALS['wphx_323_12_init'] = array();
$GLOBALS['wphx_323_12_assets'] = dirname( __FILE__ ) . '/mail-assets';

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) use ( $root ) {
\t\t$GLOBALS['wphx_323_12_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => wphx_323_12_normalize( $errstr, $root ),
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

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
}

function __( $text ) { return $text; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : false; }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function network_home_url( $path = '' ) { return 'https://www.example.test' . $path; }
function get_bloginfo( $show = '' ) { return 'charset' === $show ? 'UTF-8' : 'WordPress'; }

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( 'callback' => $callback, 'accepted_args' => $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { return add_filter( $hook_name, $callback, $priority, $accepted_args ); }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_323_12_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
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
\t$event = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tif ( isset( $args[0] ) && $args[0] instanceof WP_Error ) {
\t\t$event['error_code'] = $args[0]->get_error_code();
\t\t$event['error_message'] = wphx_323_12_normalize( $args[0]->get_error_message(), ABSPATH );
\t\t$event['mail_data'] = wphx_323_12_mail_data_summary( $args[0]->get_error_data() );
\t} elseif ( isset( $args[0] ) && is_array( $args[0] ) ) {
\t\t$event['mail_data'] = wphx_323_12_mail_data_summary( $args[0] );
\t}
\t$GLOBALS['wphx_323_12_actions'][] = $event;
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

function wphx_323_12_normalize( $value, $root ) {
\t$value = (string) $value;
\t$value = str_replace( str_replace( '\\\\', '/', $root ), '<root>', str_replace( '\\\\', '/', $value ) );
\t$value = preg_replace( '/127\\.0\\.0\\.1:\\d+/', '127.0.0.1:<port>', $value );
\t$value = preg_replace( '/port [0-9]+/', 'port <port>', $value );
\treturn $value;
}
function wphx_323_12_file_basename( $value ) {
\treturn is_string( $value ) && '' !== $value ? basename( $value ) : $value;
}
function wphx_323_12_mail_data_summary( $data ) {
\tif ( ! is_array( $data ) ) {
\t\treturn null;
\t}
\treturn array(
\t\t'to' => array_values( (array) ( $data['to'] ?? array() ) ),
\t\t'subject' => $data['subject'] ?? null,
\t\t'message_sha256' => isset( $data['message'] ) ? hash( 'sha256', (string) $data['message'] ) : null,
\t\t'headers' => array_values( (array) ( $data['headers'] ?? array() ) ),
\t\t'attachments' => array_map( 'wphx_323_12_file_basename', array_values( (array) ( $data['attachments'] ?? array() ) ) ),
\t\t'embeds' => array_map( 'wphx_323_12_file_basename', array_values( (array) ( $data['embeds'] ?? array() ) ) ),
\t\t'phpmailer_exception_code' => $data['phpmailer_exception_code'] ?? null,
\t);
}
function wphx_323_12_address_list( $list ) {
\treturn array_map(
\t\tfunction ( $entry ) {
\t\t\treturn array( 'email' => $entry[0] ?? '', 'name' => trim( $entry[1] ?? '' ) );
\t\t},
\t\t$list
\t);
}
function wphx_323_12_attachment_summary( $attachments ) {
\treturn array_map(
\t\tfunction ( $entry ) {
\t\t\treturn array(
\t\t\t\t'basename' => basename( $entry[0] ?? '' ),
\t\t\t\t'name' => $entry[2] ?? '',
\t\t\t\t'encoding' => $entry[3] ?? '',
\t\t\t\t'type' => $entry[4] ?? '',
\t\t\t\t'disposition' => $entry[6] ?? '',
\t\t\t\t'cid' => $entry[7] ?? '',
\t\t\t);
\t\t},
\t\t$attachments
\t);
}
function wphx_323_12_normalize_mime( $value ) {
\t$value = preg_replace( '/^Date:.*$/mi', 'Date: <normalized>', $value );
\t$value = preg_replace( '/^Message-ID:.*$/mi', 'Message-ID: <normalized>', $value );
\t$value = preg_replace( '/boundary="[^"]+"/i', 'boundary="<normalized>"', $value );
\t$value = preg_replace( '/b[0-9]+=_?[A-Za-z0-9._=-]+/', 'b<normalized>', $value );
\treturn $value;
}
function wphx_323_12_boundary_snapshot( $mailer, $mime_header, $mime_body ) {
\t$normalized_header = wphx_323_12_normalize_mime( $mime_header );
\t$normalized_body = wphx_323_12_normalize_mime( $mime_body );
\treturn array(
\t\t'mailer' => $mailer->Mailer,
\t\t'from' => $mailer->From,
\t\t'from_name' => $mailer->FromName,
\t\t'subject' => $mailer->Subject,
\t\t'content_type' => $mailer->ContentType,
\t\t'charset' => $mailer->CharSet,
\t\t'encoding' => $mailer->Encoding,
\t\t'to' => wphx_323_12_address_list( $mailer->getToAddresses() ),
\t\t'cc' => wphx_323_12_address_list( $mailer->getCcAddresses() ),
\t\t'bcc' => wphx_323_12_address_list( $mailer->getBccAddresses() ),
\t\t'reply_to' => wphx_323_12_address_list( array_values( $mailer->getReplyToAddresses() ) ),
\t\t'custom_headers' => $mailer->getCustomHeaders(),
\t\t'attachments' => wphx_323_12_attachment_summary( $mailer->getAttachments() ),
\t\t'mime_header_sha256' => hash( 'sha256', $normalized_header ),
\t\t'mime_body_sha256' => hash( 'sha256', $normalized_body ),
\t\t'contains_body' => str_contains( $mime_body, 'Hello phpmail boundary.' ),
\t\t'contains_attachment_filename' => str_contains( $mime_body, 'report.txt' ),
\t\t'contains_embed_cid' => str_contains( $mime_body, 'boundary-logo' ),
\t);
}

if ( ! is_dir( $GLOBALS['wphx_323_12_assets'] ) ) {
\tmkdir( $GLOBALS['wphx_323_12_assets'], 0777, true );
}
file_put_contents( $GLOBALS['wphx_323_12_assets'] . '/report.txt', 'attachment report' );
file_put_contents( $GLOBALS['wphx_323_12_assets'] . '/logo.png', 'fake-png' );

require ABSPATH . WPINC . '/PHPMailer/Exception.php';
require ABSPATH . WPINC . '/PHPMailer/SMTP.php';
require ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
require ABSPATH . WPINC . '/class-wp-phpmailer.php';

class WPHX_323_12_Boundary_PHPMailer extends WP_PHPMailer {
\tpublic $boundary_snapshots = array();
\tpublic function postSend() {
\t\t$this->boundary_snapshots[] = wphx_323_12_boundary_snapshot( $this, $this->MIMEHeader, $this->MIMEBody );
\t\treturn true;
\t}
}

require ABSPATH . WPINC . '/pluggable.php';

function wphx_323_12_common_hooks( $case, $smtp_port ) {
\tadd_filter( 'wp_mail_charset', function () { return 'ISO-8859-1'; }, 10, 1 );
\tadd_filter( 'wp_mail_embed_args', function ( $embed_args ) {
\t\t$embed_args['cid'] = 'boundary-logo';
\t\t$embed_args['name'] = 'logo.png';
\t\t$embed_args['type'] = 'image/png';
\t\treturn $embed_args;
\t}, 10, 1 );
\tadd_action(
\t\t'phpmailer_init',
\t\tfunction ( $mailer ) use ( $case, $smtp_port ) {
\t\t\tif ( 'phpmailer-transport:smtp-success' === $case ) {
\t\t\t\t$mailer->isSMTP();
\t\t\t\t$mailer->Host = '127.0.0.1';
\t\t\t\t$mailer->Port = $smtp_port;
\t\t\t\t$mailer->SMTPAutoTLS = false;
\t\t\t\t$mailer->SMTPAuth = false;
\t\t\t\t$mailer->Timeout = 5;
\t\t\t\t$mailer->SMTPDebug = 0;
\t\t\t\t$mailer->addCustomHeader( 'X-WPHX-Transport', 'smtp-capture' );
\t\t\t} elseif ( 'phpmailer-transport:smtp-failure' === $case ) {
\t\t\t\t$mailer->isSMTP();
\t\t\t\t$mailer->Host = '127.0.0.1';
\t\t\t\t$mailer->Port = 1;
\t\t\t\t$mailer->SMTPAutoTLS = false;
\t\t\t\t$mailer->SMTPAuth = false;
\t\t\t\t$mailer->Timeout = 1;
\t\t\t\t$mailer->SMTPDebug = 0;
\t\t\t} else {
\t\t\t\t$mailer->isMail();
\t\t\t\t$mailer->addCustomHeader( 'X-WPHX-Transport', 'phpmail-boundary' );
\t\t\t}
\t\t\t$GLOBALS['wphx_323_12_init'][] = array(
\t\t\t\t'case' => $case,
\t\t\t\t'class' => get_class( $mailer ),
\t\t\t\t'mailer' => $mailer->Mailer,
\t\t\t\t'host' => $mailer->Host,
\t\t\t\t'port' => $mailer->Port === $smtp_port ? '<smtp-port>' : $mailer->Port,
\t\t\t\t'smtp_auth' => $mailer->SMTPAuth,
\t\t\t\t'smtp_auto_tls' => $mailer->SMTPAutoTLS,
\t\t\t\t'timeout' => $mailer->Timeout,
\t\t\t\t'custom_header_count' => count( $mailer->getCustomHeaders() ),
\t\t\t);
\t\t},
\t\t10,
\t\t1
\t);
}
function wphx_323_12_result( $case, $result ) {
\tglobal $phpmailer;
\t$payload = array(
\t\t'case' => $case,
\t\t'result' => $result,
\t\t'error_info' => isset( $phpmailer ) ? wphx_323_12_normalize( $phpmailer->ErrorInfo, ABSPATH ) : null,
\t\t'actions' => $GLOBALS['wphx_323_12_actions'],
\t\t'filters' => $GLOBALS['wphx_323_12_filters'],
\t\t'phpmailer_init' => $GLOBALS['wphx_323_12_init'],
\t\t'php_errors' => $GLOBALS['wphx_323_12_errors'],
\t);
\tif ( $phpmailer instanceof WPHX_323_12_Boundary_PHPMailer ) {
\t\t$payload['boundary_snapshots'] = $phpmailer->boundary_snapshots;
\t}
\treturn $payload;
}

wphx_323_12_common_hooks( $case, $smtp_port );

if ( 'phpmailer-transport:smtp-success' === $case ) {
\t$result = wp_mail(
\t\t'Capture User <capture@example.test>',
\t\t'SMTP Capture Success',
\t\t'<p>Hello controlled SMTP transport.</p>',
\t\tarray(
\t\t\t'From: Sender <sender@example.test>',
\t\t\t'Cc: Copy <copy@example.test>',
\t\t\t'Bcc: Blind <blind@example.test>',
\t\t\t'Reply-To: Reply <reply@example.test>',
\t\t\t'Content-Type: text/html; charset=UTF-8',
\t\t\t'X-WPHX-Case: smtp-success',
\t\t),
\t\tarray( $GLOBALS['wphx_323_12_assets'] . '/report.txt' ),
\t\tarray( 'logo' => $GLOBALS['wphx_323_12_assets'] . '/logo.png' )
\t);
\techo json_encode( wphx_323_12_result( $case, $result ), JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\texit;
}

if ( 'phpmailer-transport:smtp-failure' === $case ) {
\t$result = wp_mail(
\t\t'Failure User <failure@example.test>',
\t\t'SMTP Capture Failure',
\t\t'This message should fail locally.',
\t\tarray(
\t\t\t'From: Sender <sender@example.test>',
\t\t\t'X-WPHX-Case: smtp-failure',
\t\t)
\t);
\techo json_encode( wphx_323_12_result( $case, $result ), JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\texit;
}

if ( 'phpmailer-transport:phpmail-boundary' === $case ) {
\t$GLOBALS['phpmailer'] = new WPHX_323_12_Boundary_PHPMailer( true );
\t$GLOBALS['phpmailer']::$validator = static function ( $email ) {
\t\treturn (bool) is_email( $email );
\t};
\t$result = wp_mail(
\t\t'Boundary User <boundary@example.test>',
\t\t'PHP Mail Boundary',
\t\t'<p>Hello phpmail boundary.</p><img src="cid:boundary-logo">',
\t\tarray(
\t\t\t'From: Sender <sender@example.test>',
\t\t\t'Cc: Copy <copy@example.test>',
\t\t\t'Reply-To: Reply <reply@example.test>',
\t\t\t'Content-Type: text/html; charset=UTF-8',
\t\t\t'X-WPHX-Case: phpmail-boundary',
\t\t),
\t\tarray( $GLOBALS['wphx_323_12_assets'] . '/report.txt' ),
\t\tarray( 'logo' => $GLOBALS['wphx_323_12_assets'] . '/logo.png' )
\t);
\techo json_encode( wphx_323_12_result( $case, $result ), JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\texit;
}

fwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
exit( 2 );
`
  );
}

async function freePort() {
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

async function createSmtpCaptureServer() {
  const captures = [];
  const port = await freePort();
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    const state = { mailFrom: "", rcptTo: [], data: "", inData: false, buffer: "" };
    socket.setEncoding("utf8");
    socket.setTimeout(5000, () => socket.destroy());
    socket.write("220 wphx.local ESMTP\r\n");
    socket.on("close", () => {
      sockets.delete(socket);
    });
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
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port,
    captures,
    reset: () => {
      captures.length = 0;
    },
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(resolve);
      })
  };
}

function normalizeMime(value) {
  return value
    .replace(/^Date:.*$/gim, "Date: <normalized>")
    .replace(/^Message-ID:.*$/gim, "Message-ID: <normalized>")
    .replace(/boundary="[^"]+"/gi, 'boundary="<normalized>"')
    .replace(/b[0-9]+=_?[A-Za-z0-9._=-]+/g, "b<normalized>");
}

function smtpHeader(data, name) {
  const match = data.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match ? match[1].trim().replace(/\\"/g, '"') : null;
}

function normalizeSmtpCaptures(captures) {
  return captures.map((capture) => {
    const normalized = normalizeMime(capture.data);
    return {
      mail_from: capture.mailFrom,
      rcpt_to: capture.rcptTo,
      headers: {
        subject: smtpHeader(capture.data, "Subject"),
        from: smtpHeader(capture.data, "From"),
        to: smtpHeader(capture.data, "To"),
        cc: smtpHeader(capture.data, "Cc"),
        content_type: smtpHeader(capture.data, "Content-Type"),
        x_wphx_case: smtpHeader(capture.data, "X-WPHX-Case"),
        x_wphx_transport: smtpHeader(capture.data, "X-WPHX-Transport")
      },
      features: {
        contains_html_body: capture.data.includes("Hello controlled SMTP transport."),
        contains_attachment_filename: capture.data.includes("report.txt"),
        contains_embed_cid: capture.data.includes("boundary-logo"),
        normalized_data_sha256: sha256(normalized)
      }
    };
  });
}

function runProbe(root, testCase, smtpPort) {
  return new Promise((resolve, reject) => {
    const child = spawn("php", [PROBE, root, testCase.id, String(smtpPort)], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code !== 0) {
        reject(new Error(`PHP probe failed for ${testCase.id} (${code ?? signal}): ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Unable to parse PHP probe output for ${testCase.id}: ${error.message}\n${stdout}\n${stderr}`));
      }
    });
  });
}

function lintFiles(files) {
  return files.map((path) => {
    command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]);
    command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)]);
    return path;
  });
}

function observationsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateInputs({ sourceFiles }) {
  const strategy = readJson(STRATEGY);
  const mailGates = readJson(MAIL_GATES);
  const apiReflection = readJson(API_REFLECTION);
  const setupFixture = readJson(SETUP_FIXTURE);
  const transportFloor = readJson(TRANSPORT_FLOOR);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const plannedGate = mailGates.gate_plan.find((gate) => gate.id === "phpmailer-controlled-smtp-and-phpmail-transport");
  if (!plannedGate) throw new Error("WPHX-323.03 controlled PHPMailer transport gate plan is missing");
  if (plannedGate.downstream_issue.external_ref !== "WPHX-323.12") throw new Error("WPHX-323.03 transport gate does not point to WPHX-323.12");
  const phpmailerBoundary = vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "phpmailer");
  if (!phpmailerBoundary) throw new Error("PHPMailer vendor boundary missing from WPHX-323 closure");
  if (phpmailerBoundary.source_inventory.count !== 7 || phpmailerBoundary.distribution_artifacts.count !== 7) {
    throw new Error("PHPMailer source/distribution inventory count changed; refresh WPHX-323 before transport gate");
  }
  if ((apiReflection.validation_result?.modern_symbol_count ?? 0) < 8) throw new Error("WPHX-323.11 API/reflection floor is incomplete");
  return {
    strategy: fileRecord(STRATEGY),
    mail_gates: fileRecord(MAIL_GATES),
    api_reflection: fileRecord(API_REFLECTION),
    setup_fixture: fileRecord(SETUP_FIXTURE),
    transport_floor: fileRecord(TRANSPORT_FLOOR),
    vendor_closure: fileRecord(VENDOR_CLOSURE),
    planned_gate: plannedGate,
    existing_floor_ids: [
      setupFixture.id ?? "wphx-312-13-phpmailer-setup-oracle-fixture",
      transportFloor.id ?? "wphx-312-93-cron-mail-transport-installed-gate",
      strategy.id ?? "wphx-323-01-php-vendor-replacement-strategy"
    ],
    source_inventory_count: sourceFiles.filter((path) => path.startsWith(`${PHPMAILER_ROOT}/`)).length
  };
}

async function buildArtifacts() {
  const phpmailerFiles = listFiles(PHPMAILER_ROOT);
  const sourceFiles = [...phpmailerFiles, ...SUPPORT_FILES].sort();
  const inputEvidence = validateInputs({ sourceFiles });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();
  command("php", ["-l", PROBE]);
  const lintedFiles = lintFiles(sourceFiles);
  const smtpServer = await createSmtpCaptureServer();
  try {
    const observations = [];
    for (const testCase of CASES.filter((caseRecord) => caseRecord.id !== "phpmailer-transport:blocked-host-conditions")) {
      smtpServer.reset();
      const oracle = await runProbe(ORACLE_ROOT, testCase, smtpServer.port);
      const oracleSmtp = normalizeSmtpCaptures(smtpServer.captures);
      smtpServer.reset();
      const candidate = await runProbe(CANDIDATE_ROOT, testCase, smtpServer.port);
      const candidateSmtp = normalizeSmtpCaptures(smtpServer.captures);
      const oracleObservation = { php: oracle, smtp_captures: oracleSmtp };
      const candidateObservation = { php: candidate, smtp_captures: candidateSmtp };
      observations.push({
        id: testCase.id,
        focus: testCase.focus,
        oracle: oracleObservation,
        candidate: candidateObservation,
        observations_equal: observationsEqual(oracleObservation, candidateObservation)
      });
    }

    const blockedObservation = {
      id: "phpmailer-transport:blocked-host-conditions",
      focus: CASES.find((caseRecord) => caseRecord.id === "phpmailer-transport:blocked-host-conditions").focus,
      blocked_conditions: BLOCKED_CONDITIONS,
      fallback_policy: "Use preserved upstream PHPMailer for authenticated SMTP, TLS/STARTTLS, proxy, DNS/MX, host mail(), remote server policy, bounce/retry, and operational delivery until dedicated deterministic or installed gates pass.",
      observations_equal: true
    };
    const allObservations = [...observations, blockedObservation];
    const allEqual = allObservations.every((observation) => observation.observations_equal);
    if (!allEqual) {
      throw new Error("PHPMailer transport oracle/candidate observations differ");
    }

    const manifest = {
      schema: "wphx.wp-core.phpmailer-transport-gate.v1",
      issue: ISSUE,
      generated_at: RECORDED_AT,
      generator: RUNNER,
      evidence_class: "preserved_phpmailer_controlled_transport_gate",
      boundary_id: "phpmailer",
      behavior_parity_claimed: false,
      controlled_transport_observation_claimed: true,
      operational_mail_delivery_claimed: false,
      installed_wordpress_mail_parity_claimed: false,
      generated_public_php_replacement_claimed: false,
      haxe_owned_runtime_claimed: false,
      copied_phpmailer_artifact_retirement_claimed: false,
      inputs: inputEvidence,
      source_files: sourceFiles.map(sourceRecord),
      linted_files: lintedFiles,
      covered_symbols: COVERED_SYMBOLS,
      cases: CASES,
      observations: allObservations,
      blocked_conditions: BLOCKED_CONDITIONS,
      validation_result: {
        phpmailer_source_inventory_count: inputEvidence.source_inventory_count,
        mirrored_support_file_count: SUPPORT_FILES.length,
        linted_file_count: lintedFiles.length * 2 + 1,
        fixture_case_count: CASES.length,
        executable_transport_case_count: observations.length,
        blocked_condition_count: BLOCKED_CONDITIONS.length,
        controlled_smtp_capture_count: observations.find((observation) => observation.id === "phpmailer-transport:smtp-success").oracle.smtp_captures.length,
        smtp_failure_observed: observations.find((observation) => observation.id === "phpmailer-transport:smtp-failure").oracle.php.result === false,
        phpmail_boundary_snapshot_count: observations.find((observation) => observation.id === "phpmailer-transport:phpmail-boundary").oracle.php.boundary_snapshots.length,
        observations_equal: allEqual,
        generated_overlay_manifest_present: false,
        candidate_package_difference_count: 0
      },
      claims: [
        "Regenerated oracle and candidate roots contain the preserved WordPress 7.0 PHPMailer package, WordPress PHPMailer shims, and pluggable wp_mail source at locked hashes.",
        "Controlled loopback SMTP success records wp_mail/PHPMailer header parsing, charset filter, attachment and embedded-image setup, phpmailer_init mutation, SMTP envelope/data capture, and wp_mail_succeeded hook payloads.",
        "Controlled loopback SMTP failure records PHPMailer failure propagation, ErrorInfo normalization, and wp_mail_failed hook payloads without external delivery.",
        "The PHP mail() boundary case records MIME/header/body shape through a test subclass that avoids invoking host mail delivery."
      ],
      non_claims: [
        "This gate does not implement Haxe-owned PHPMailer runtime logic or generated PHPMailer wrappers.",
        "This gate does not retire copied PHPMailer artifacts or claim generated public PHP replacement.",
        "This gate does not prove installed WordPress mail parity, external SMTP delivery, DNS/MX behavior, authenticated SMTP, TLS/STARTTLS, proxy behavior, bounce/retry semantics, or host mail() delivery.",
        "The candidate root is copied upstream PHPMailer fallback evidence only and must not be distributed or cited as replacement implementation source."
      ]
    };
    const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
    const ownership = {
      schema: "wphx.ownership-manifest.v1",
      issue: ISSUE,
      generated_at: RECORDED_AT,
      artifact: OUT,
      ownership_state: "preserved_upstream_vendor_controlled_transport_fixture",
      boundary_id: "phpmailer",
      source_authority: "../wordpress-develop WordPress 7.0 PHPMailer package, WP_PHPMailer shim, and pluggable wp_mail source",
      whole_file_owned: false,
      behavior_parity_claimed: false,
      controlled_transport_observation_claimed: true,
      operational_mail_delivery_claimed: false,
      installed_wordpress_mail_parity_claimed: false,
      generated_public_php_replacement_claimed: false,
      haxe_owned_runtime_claimed: false,
      durable_original_path_adapter_claimed: false,
      copied_upstream_php_executed: true,
      generated_overlay_manifest_present: false,
      removal_gate: "Replace this preserved-package transport fixture with generated wrapper/runtime evidence only after WPHX-323.13 replacement decision, generated overlay manifests, controlled SMTP/phpmail transport parity, authenticated/TLS/DNS condition gates, PHP lint, reflection/API compatibility, and installed mail behavior gates pass.",
      non_claims: manifest.non_claims
    };
    const ownershipContent = `${JSON.stringify(ownership, null, 2)}\n`;
    const receipt = {
      schema: "wphx.wp-core-receipt.v1",
      id: "wphx-323-12-phpmailer-transport-gate",
      issue: ISSUE,
      recorded_at: RECORDED_AT,
      status: "closed",
      evidence_class: "preserved_phpmailer_controlled_transport_gate",
      artifact_scope: "wordpress-7.0-preserved-phpmailer-wp-mail-controlled-transport",
      commands: [
        "npm run wp:core:wphx-323-phpmailer-transport",
        "npm run wp:core:wphx-323-phpmailer-transport:check"
      ],
      artifacts: {
        manifest: OUT,
        ownership_manifest: OWNERSHIP,
        parent_mail_vendor_gate_manifest: MAIL_GATES,
        api_reflection_floor_manifest: API_REFLECTION,
        existing_transport_floor_manifest: TRANSPORT_FLOOR
      },
      manifest_sha256: sha256(manifestContent),
      validation_result: manifest.validation_result,
      claims: manifest.claims,
      non_claims: manifest.non_claims
    };
    writeOrCheck(OUT, manifestContent);
    writeOrCheck(OWNERSHIP, ownershipContent);
    writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
    return manifest;
  } finally {
    await smtpServer.close();
  }
}

buildArtifacts()
  .then((manifest) => {
    console.log(
      JSON.stringify(
        {
          ok: true,
          check: checkOnly,
          manifest: OUT,
          receipt: RECEIPT,
          fixture_case_count: manifest.validation_result.fixture_case_count,
          blocked_condition_count: manifest.validation_result.blocked_condition_count,
          observations_equal: manifest.validation_result.observations_equal
        },
        null,
        2
      )
    );
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
