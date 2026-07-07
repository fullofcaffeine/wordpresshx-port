#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-gufh",
  external_ref: "WPHX-323.18",
  title: "Add sodium_compat native fallback security gate"
};
const RECORDED_AT = "2026-07-08T06:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-sodium-compat-native-fallback-security-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-18";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/sodium-compat-native-fallback-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MEDIA_GATES = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const WPHX_306_05 = "manifests/wp-core/wphx-306-05-password-application-fixture.v1.json";
const WPHX_306_07 = "manifests/wp-core/wphx-306-07-auth-installed-distribution-gate.v1.json";
const OUT = "manifests/wp-core/wphx-323-18-sodium-compat-native-fallback-security-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-18-sodium-compat-native-fallback-security-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-18-sodium-compat-native-fallback-security-gate.v1.json";

const SODIUM_ROOT = "src/wp-includes/sodium_compat";
const EXPECTED_PHP_FILE_COUNT = 104;
const NOTICE_FILES = [
  "src/wp-includes/sodium_compat/LICENSE",
  "src/wp-includes/sodium_compat/composer.json",
  "src/wp-includes/sodium_compat/src/Core/Curve25519/README.md",
  "src/wp-includes/sodium_compat/src/Core32/Curve25519/README.md"
];
const CASES = [
  { id: "sodium:api-reflection-constants", focus: "native sodium, global polyfills, constants, and ParagonIE_Sodium_Compat reflection surface" },
  { id: "sodium:base64-encoding-errors", focus: "base64 variant round trips plus invalid encoding error shapes" },
  { id: "sodium:generichash-key-size", focus: "generic hash native/direct fallback output and invalid key-size behavior" },
  { id: "sodium:secretbox-nonce-key", focus: "secretbox encryption/decryption, wrong-key false result, and invalid nonce behavior" },
  { id: "sodium:auth-verify", focus: "crypto_auth MAC equality and verification failure behavior" },
  { id: "sodium:sign-detached", focus: "deterministic seed keypair, detached signature, and bad signature verification" },
  { id: "sodium:password-hash-boundary", focus: "password hash API availability, native verify shape, and pure-PHP fallback unsupported behavior" },
  { id: "sodium:randombytes-policy", focus: "randombytes API availability is recorded without deterministic output claims" }
];
const COVERED_SYMBOLS = [
  "ParagonIE_Sodium_Compat",
  "ParagonIE_Sodium_Compat::$disableFallbackForUnitTests",
  "ParagonIE_Sodium_Compat::base642bin",
  "ParagonIE_Sodium_Compat::bin2base64",
  "ParagonIE_Sodium_Compat::crypto_auth",
  "ParagonIE_Sodium_Compat::crypto_auth_verify",
  "ParagonIE_Sodium_Compat::crypto_generichash",
  "ParagonIE_Sodium_Compat::crypto_pwhash_str",
  "ParagonIE_Sodium_Compat::crypto_pwhash_str_verify",
  "ParagonIE_Sodium_Compat::crypto_secretbox",
  "ParagonIE_Sodium_Compat::crypto_secretbox_open",
  "ParagonIE_Sodium_Compat::crypto_sign_detached",
  "ParagonIE_Sodium_Compat::crypto_sign_publickey",
  "ParagonIE_Sodium_Compat::crypto_sign_secretkey",
  "ParagonIE_Sodium_Compat::crypto_sign_seed_keypair",
  "ParagonIE_Sodium_Compat::crypto_sign_verify_detached",
  "SodiumException",
  "sodium_base642bin",
  "sodium_bin2base64",
  "sodium_crypto_auth",
  "sodium_crypto_auth_verify",
  "sodium_crypto_generichash",
  "sodium_crypto_pwhash_str",
  "sodium_crypto_pwhash_str_needs_rehash",
  "sodium_crypto_pwhash_str_verify",
  "sodium_crypto_secretbox",
  "sodium_crypto_secretbox_open",
  "sodium_crypto_sign_detached",
  "sodium_crypto_sign_publickey",
  "sodium_crypto_sign_secretkey",
  "sodium_crypto_sign_seed_keypair",
  "sodium_crypto_sign_verify_detached",
  "sodium_randombytes_buf"
];
const BLOCKED_CONDITIONS = [
  {
    id: "true-extension-off-installed-host",
    status: "blocked",
    reason:
      "The local PHP binary reports ext/sodium loaded even under php -n, so this gate records native-on behavior plus direct ParagonIE_Sodium_Compat pure-PHP fallback behavior. A host where ext/sodium is genuinely unavailable remains a separate installed/runtime gate."
  },
  {
    id: "constant-time-proof",
    status: "blocked",
    reason:
      "The gate records equality and verification surfaces and preserved fallback policy, but it does not prove constant-time behavior or replace a security audit for timing-sensitive implementations."
  },
  {
    id: "haxe-owned-crypto-implementation",
    status: "blocked",
    reason:
      "Oracle and candidate roots both execute copied upstream sodium_compat artifacts. No Haxe-owned cryptographic implementation, generated WPHX PHP adapter, or host-primitive replacement is introduced."
  },
  {
    id: "copied-sodium-retirement",
    status: "blocked",
    reason:
      "Copied sodium_compat artifacts stay preserved until WPHX-323.22 accepts a replacement/provenance decision with security, ecosystem, installed, and generated-overlay evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
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
    distribution_path: path.replace(/^src\//, ""),
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function artifactRecords(distributionPaths) {
  const wanted = new Set(distributionPaths);
  return readFileSync(ARTIFACT_PROVENANCE, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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
  mkdirSync(mirrorPath(root, SODIUM_ROOT), { recursive: true });
  cpSync(upstreamPath(SODIUM_ROOT), mirrorPath(root, SODIUM_ROOT), { recursive: true });
}

function sourceMarkers(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    paragonie_marker: /ParagonIE|Sodium_Compat|libsodium|sodium/i.test(content),
    php_polyfill_guard_count: (content.match(/if \(!is_callable\('sodium_/g) || []).length,
    constant_bridge_count: (content.match(/SODIUM_/g) || []).length,
    security_marker: /constant.?time|timing|crypto|password|hash|encrypt|decrypt|signature|nonce|key|random/i.test(content),
    fallback_marker: /fallback|disableFallbackForUnitTests|extension_loaded\('sodium'\)|is_callable\('sodium_/i.test(content)
  };
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

require $root . '/wp-includes/sodium_compat/autoload.php';

function wphx_sha($value) {
\treturn 'sha256:' . hash('sha256', $value);
}

function wphx_string_summary($value) {
\treturn array(
\t\t'type' => 'string',
\t\t'length' => strlen($value),
\t\t'sha256' => wphx_sha($value),
\t);
}

function wphx_value_summary($value) {
\tif (is_string($value)) {
\t\treturn wphx_string_summary($value);
\t}
\tif (is_bool($value) || is_int($value) || is_float($value) || null === $value) {
\t\treturn $value;
\t}
\tif (is_array($value)) {
\t\treturn array(
\t\t\t'type' => 'array',
\t\t\t'count' => count($value),
\t\t\t'keys' => array_map('strval', array_keys($value)),
\t\t);
\t}
\treturn array('type' => gettype($value));
}

function wphx_error_shape(Throwable $throwable) {
\treturn array(
\t\t'class' => get_class($throwable),
\t\t'code' => $throwable->getCode(),
\t\t'message_sha256' => wphx_sha($throwable->getMessage()),
\t);
}

function wphx_capture(callable $fn) {
\ttry {
\t\treturn array('ok' => true, 'value' => wphx_value_summary($fn()));
\t} catch (Throwable $throwable) {
\t\treturn array('ok' => false, 'error' => wphx_error_shape($throwable));
\t}
}

function wphx_native(callable $fn) {
\tParagonIE_Sodium_Compat::$disableFallbackForUnitTests = false;
\treturn wphx_capture($fn);
}

function wphx_fallback(callable $fn) {
\tParagonIE_Sodium_Compat::$disableFallbackForUnitTests = true;
\t$result = wphx_capture($fn);
\tParagonIE_Sodium_Compat::$disableFallbackForUnitTests = false;
\treturn $result;
}

function wphx_compare_result($native, $fallback) {
\treturn array(
\t\t'native' => $native,
\t\t'fallback' => $fallback,
\t\t'matching_summary' => $native === $fallback,
\t);
}

function wphx_reflect_method($class, $method) {
\tif (!method_exists($class, $method)) {
\t\treturn array('exists' => false);
\t}
\t$reflection = new ReflectionMethod($class, $method);
\treturn array(
\t\t'exists' => true,
\t\t'public' => $reflection->isPublic(),
\t\t'static' => $reflection->isStatic(),
\t\t'parameters' => $reflection->getNumberOfParameters(),
\t\t'required_parameters' => $reflection->getNumberOfRequiredParameters(),
\t);
}

function wphx_reflect_function($function) {
\tif (!function_exists($function)) {
\t\treturn array('exists' => false);
\t}
\t$reflection = new ReflectionFunction($function);
\treturn array(
\t\t'exists' => true,
\t\t'parameters' => $reflection->getNumberOfParameters(),
\t\t'required_parameters' => $reflection->getNumberOfRequiredParameters(),
\t);
}

$message = "WordPressHX sodium fixture\\0message";
$hash_key = str_repeat("k", SODIUM_CRYPTO_GENERICHASH_KEYBYTES);
$secretbox_key = str_repeat("\\x01", SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
$secretbox_wrong_key = str_repeat("\\x03", SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
$secretbox_nonce = str_repeat("\\x02", SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
$auth_key = str_repeat("\\x04", SODIUM_CRYPTO_AUTH_KEYBYTES);
$sign_seed = str_repeat("\\x05", SODIUM_CRYPTO_SIGN_SEEDBYTES);

$selected_functions = array(
\t'sodium_bin2base64',
\t'sodium_base642bin',
\t'sodium_crypto_generichash',
\t'sodium_crypto_secretbox',
\t'sodium_crypto_secretbox_open',
\t'sodium_crypto_auth',
\t'sodium_crypto_auth_verify',
\t'sodium_crypto_sign_seed_keypair',
\t'sodium_crypto_sign_secretkey',
\t'sodium_crypto_sign_publickey',
\t'sodium_crypto_sign_detached',
\t'sodium_crypto_sign_verify_detached',
\t'sodium_crypto_pwhash_str',
\t'sodium_crypto_pwhash_str_verify',
\t'sodium_crypto_pwhash_str_needs_rehash',
\t'sodium_randombytes_buf',
);
$selected_methods = array(
\t'bin2base64',
\t'base642bin',
\t'crypto_generichash',
\t'crypto_secretbox',
\t'crypto_secretbox_open',
\t'crypto_auth',
\t'crypto_auth_verify',
\t'crypto_sign_seed_keypair',
\t'crypto_sign_secretkey',
\t'crypto_sign_publickey',
\t'crypto_sign_detached',
\t'crypto_sign_verify_detached',
\t'crypto_pwhash_str',
\t'crypto_pwhash_str_verify',
\t'randombytes_buf',
);
$selected_constants = array(
\t'SODIUM_BASE64_VARIANT_ORIGINAL',
\t'SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING',
\t'SODIUM_CRYPTO_AUTH_BYTES',
\t'SODIUM_CRYPTO_AUTH_KEYBYTES',
\t'SODIUM_CRYPTO_GENERICHASH_BYTES',
\t'SODIUM_CRYPTO_GENERICHASH_KEYBYTES',
\t'SODIUM_CRYPTO_SECRETBOX_KEYBYTES',
\t'SODIUM_CRYPTO_SECRETBOX_NONCEBYTES',
\t'SODIUM_CRYPTO_SIGN_BYTES',
\t'SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES',
\t'SODIUM_CRYPTO_SIGN_SECRETKEYBYTES',
\t'SODIUM_CRYPTO_SIGN_SEEDBYTES',
\t'SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE',
\t'SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE',
);

$reflected_functions = array();
foreach ($selected_functions as $function) {
\t$reflected_functions[$function] = wphx_reflect_function($function);
}
$reflected_methods = array();
foreach ($selected_methods as $method) {
\t$reflected_methods[$method] = wphx_reflect_method('ParagonIE_Sodium_Compat', $method);
}
$constant_values = array();
foreach ($selected_constants as $constant) {
\t$constant_values[$constant] = defined($constant) ? constant($constant) : null;
}

$base64_url_native = wphx_native(fn() => sodium_bin2base64($message, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING));
$base64_url_fallback = wphx_fallback(fn() => ParagonIE_Sodium_Compat::bin2base64($message, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING));
$base64_original_native = wphx_native(fn() => sodium_bin2base64($message, SODIUM_BASE64_VARIANT_ORIGINAL));
$base64_original_fallback = wphx_fallback(fn() => ParagonIE_Sodium_Compat::bin2base64($message, SODIUM_BASE64_VARIANT_ORIGINAL));
$base64_url_encoded = sodium_bin2base64($message, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
$base64_original_encoded = sodium_bin2base64($message, SODIUM_BASE64_VARIANT_ORIGINAL);

$secretbox_native_raw = sodium_crypto_secretbox($message, $secretbox_nonce, $secretbox_key);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = true;
$secretbox_fallback_raw = ParagonIE_Sodium_Compat::crypto_secretbox($message, $secretbox_nonce, $secretbox_key);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = false;

$auth_native_raw = sodium_crypto_auth($message, $auth_key);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = true;
$auth_fallback_raw = ParagonIE_Sodium_Compat::crypto_auth($message, $auth_key);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = false;

$native_keypair = sodium_crypto_sign_seed_keypair($sign_seed);
$native_secret = sodium_crypto_sign_secretkey($native_keypair);
$native_public = sodium_crypto_sign_publickey($native_keypair);
$native_signature = sodium_crypto_sign_detached($message, $native_secret);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = true;
$fallback_keypair = ParagonIE_Sodium_Compat::crypto_sign_seed_keypair($sign_seed);
$fallback_secret = ParagonIE_Sodium_Compat::crypto_sign_secretkey($fallback_keypair);
$fallback_public = ParagonIE_Sodium_Compat::crypto_sign_publickey($fallback_keypair);
$fallback_signature = ParagonIE_Sodium_Compat::crypto_sign_detached($message, $fallback_secret);
ParagonIE_Sodium_Compat::$disableFallbackForUnitTests = false;

$native_password_hash = sodium_crypto_pwhash_str('wphx-password', SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE, SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE);

$observations = array(
\t'sodium:api-reflection-constants' => array(
\t\t'php_version' => PHP_VERSION,
\t\t'extension_loaded_sodium' => extension_loaded('sodium'),
\t\t'extension_loaded_libsodium' => extension_loaded('libsodium'),
\t\t'class_exists_paragonie_compat' => class_exists('ParagonIE_Sodium_Compat'),
\t\t'class_exists_sodium_exception' => class_exists('SodiumException'),
\t\t'disable_fallback_property' => property_exists('ParagonIE_Sodium_Compat', 'disableFallbackForUnitTests'),
\t\t'functions' => $reflected_functions,
\t\t'methods' => $reflected_methods,
\t\t'constants' => $constant_values,
\t),
\t'sodium:base64-encoding-errors' => array(
\t\t'urlsafe_no_padding' => wphx_compare_result($base64_url_native, $base64_url_fallback),
\t\t'original' => wphx_compare_result($base64_original_native, $base64_original_fallback),
\t\t'urlsafe_roundtrip' => array(
\t\t\t'native' => sodium_base642bin($base64_url_encoded, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING) === $message,
\t\t\t'fallback' => ParagonIE_Sodium_Compat::base642bin($base64_url_encoded, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING) === $message,
\t\t),
\t\t'original_roundtrip' => array(
\t\t\t'native' => sodium_base642bin($base64_original_encoded, SODIUM_BASE64_VARIANT_ORIGINAL) === $message,
\t\t\t'fallback' => ParagonIE_Sodium_Compat::base642bin($base64_original_encoded, SODIUM_BASE64_VARIANT_ORIGINAL) === $message,
\t\t),
\t\t'invalid_input' => wphx_compare_result(
\t\t\twphx_native(fn() => sodium_base642bin('@@@', SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING)),
\t\t\twphx_fallback(fn() => ParagonIE_Sodium_Compat::base642bin('@@@', SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING))
\t\t),
\t),
\t'sodium:generichash-key-size' => array(
\t\t'valid' => wphx_compare_result(
\t\t\twphx_native(fn() => sodium_crypto_generichash($message, $hash_key, SODIUM_CRYPTO_GENERICHASH_BYTES)),
\t\t\twphx_fallback(fn() => ParagonIE_Sodium_Compat::crypto_generichash($message, $hash_key, SODIUM_CRYPTO_GENERICHASH_BYTES))
\t\t),
\t\t'invalid_short_key' => wphx_compare_result(
\t\t\twphx_native(fn() => sodium_crypto_generichash($message, 'short', SODIUM_CRYPTO_GENERICHASH_BYTES)),
\t\t\twphx_fallback(fn() => ParagonIE_Sodium_Compat::crypto_generichash($message, 'short', SODIUM_CRYPTO_GENERICHASH_BYTES))
\t\t),
\t),
\t'sodium:secretbox-nonce-key' => array(
\t\t'ciphertext' => wphx_compare_result(wphx_value_summary($secretbox_native_raw), wphx_value_summary($secretbox_fallback_raw)),
\t\t'open_roundtrip' => array(
\t\t\t'native' => sodium_crypto_secretbox_open($secretbox_native_raw, $secretbox_nonce, $secretbox_key) === $message,
\t\t\t'fallback' => ParagonIE_Sodium_Compat::crypto_secretbox_open($secretbox_fallback_raw, $secretbox_nonce, $secretbox_key) === $message,
\t\t),
\t\t'wrong_key_false' => array(
\t\t\t'native' => false === sodium_crypto_secretbox_open($secretbox_native_raw, $secretbox_nonce, $secretbox_wrong_key),
\t\t\t'fallback' => false === ParagonIE_Sodium_Compat::crypto_secretbox_open($secretbox_fallback_raw, $secretbox_nonce, $secretbox_wrong_key),
\t\t),
\t\t'invalid_nonce' => wphx_compare_result(
\t\t\twphx_native(fn() => sodium_crypto_secretbox($message, 'bad-nonce', $secretbox_key)),
\t\t\twphx_fallback(fn() => ParagonIE_Sodium_Compat::crypto_secretbox($message, 'bad-nonce', $secretbox_key))
\t\t),
\t),
\t'sodium:auth-verify' => array(
\t\t'mac' => wphx_compare_result(wphx_value_summary($auth_native_raw), wphx_value_summary($auth_fallback_raw)),
\t\t'verify_ok' => array(
\t\t\t'native' => sodium_crypto_auth_verify($auth_native_raw, $message, $auth_key),
\t\t\t'fallback' => ParagonIE_Sodium_Compat::crypto_auth_verify($auth_fallback_raw, $message, $auth_key),
\t\t),
\t\t'verify_bad_message' => array(
\t\t\t'native' => sodium_crypto_auth_verify($auth_native_raw, $message . 'x', $auth_key),
\t\t\t'fallback' => ParagonIE_Sodium_Compat::crypto_auth_verify($auth_fallback_raw, $message . 'x', $auth_key),
\t\t),
\t),
\t'sodium:sign-detached' => array(
\t\t'keypair' => wphx_compare_result(wphx_value_summary($native_keypair), wphx_value_summary($fallback_keypair)),
\t\t'public_key' => wphx_compare_result(wphx_value_summary($native_public), wphx_value_summary($fallback_public)),
\t\t'signature' => wphx_compare_result(wphx_value_summary($native_signature), wphx_value_summary($fallback_signature)),
\t\t'verify_ok' => array(
\t\t\t'native' => sodium_crypto_sign_verify_detached($native_signature, $message, $native_public),
\t\t\t'fallback' => ParagonIE_Sodium_Compat::crypto_sign_verify_detached($fallback_signature, $message, $fallback_public),
\t\t),
\t\t'verify_bad' => array(
\t\t\t'native' => sodium_crypto_sign_verify_detached(str_repeat("\\x00", SODIUM_CRYPTO_SIGN_BYTES), $message, $native_public),
\t\t\t'fallback' => ParagonIE_Sodium_Compat::crypto_sign_verify_detached(str_repeat("\\x00", SODIUM_CRYPTO_SIGN_BYTES), $message, $fallback_public),
\t\t),
\t),
\t'sodium:password-hash-boundary' => array(
\t\t'native_hash_shape' => array(
\t\t\t'length' => strlen($native_password_hash),
\t\t\t'prefix' => substr($native_password_hash, 0, 7),
\t\t\t'verify_ok' => sodium_crypto_pwhash_str_verify($native_password_hash, 'wphx-password'),
\t\t\t'verify_bad' => sodium_crypto_pwhash_str_verify($native_password_hash, 'wrong-password'),
\t\t\t'needs_rehash' => sodium_crypto_pwhash_str_needs_rehash(
\t\t\t\t$native_password_hash,
\t\t\t\tSODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
\t\t\t\tSODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE
\t\t\t),
\t\t),
\t\t'pure_php_fallback_hash_shape' => wphx_fallback(
\t\t\tfn() => ParagonIE_Sodium_Compat::crypto_pwhash_str(
\t\t\t\t'wphx-password',
\t\t\t\tSODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
\t\t\t\tSODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE
\t\t\t)
\t\t),
\t\t'fallback_policy' => 'Preserve upstream sodium_compat and native sodium handoff for password hashing; pure-PHP Argon2i password hash generation is expected to be unsupported by sodium_compat.',
\t),
\t'sodium:randombytes-policy' => array(
\t\t'native_function_exists' => function_exists('sodium_randombytes_buf'),
\t\t'compat_method_exists' => method_exists('ParagonIE_Sodium_Compat', 'randombytes_buf'),
\t\t'deterministic_output_claimed' => false,
\t\t'policy' => 'Random output is not committed to the manifest. Replacement requires entropy-source review and host fallback evidence.',
\t),
);

echo json_encode(array('observations' => $observations), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`
  );
}

function runProbe(root) {
  const output = command("php", [PROBE, root]);
  return {
    command: `php ${PROBE} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function lintFiles(root, phpFiles) {
  return phpFiles.map((path) => {
    const target = mirrorPath(root, path);
    const output = command("php", ["-l", target]);
    return {
      path: path.replace(/^src\//, ""),
      command: `php -l ${target}`,
      output_sha256: sha256(output),
      ok: /No syntax errors detected/.test(output)
    };
  });
}

function noIniHostProbe() {
  const code = "echo json_encode(array('php_version'=>PHP_VERSION,'extension_loaded_sodium'=>extension_loaded('sodium'),'function_exists_sodium_crypto_generichash'=>function_exists('sodium_crypto_generichash')), JSON_PRETTY_PRINT) . \"\\n\";";
  const output = command("php", ["-n", "-r", code]);
  return {
    command: "php -n -r <sodium host probe>",
    result: JSON.parse(output),
    raw_output_sha256: sha256(output),
    extension_off_available: JSON.parse(output).extension_loaded_sodium === false
  };
}

function validateInputs({ phpFiles, artifactEvidence, strategy, mediaGates, vendorClosure }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "sodium_compat");
  const mediaGate = mediaGates.gate_plan.find((entry) => entry.id === "sodium-compat-api-security-native-fallback");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "sodium_compat");

  if (phpFiles.length !== EXPECTED_PHP_FILE_COUNT) failures.push(`expected ${EXPECTED_PHP_FILE_COUNT} sodium_compat PHP files, found ${phpFiles.length}`);
  if (artifactEvidence.length !== phpFiles.length) failures.push(`expected ${phpFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  if (strategyPlan?.replacement_strategy !== "host_primitive_backed_reimplementation_with_preserved_fallback") {
    failures.push(`unexpected sodium_compat strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (mediaGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.05 sodium gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== EXPECTED_PHP_FILE_COUNT || boundary?.distribution_artifacts.count !== EXPECTED_PHP_FILE_COUNT) {
    failures.push("WPHX-323 vendor closure sodium_compat counts do not match the expected 104 PHP files");
  }
  for (const path of [WPHX_306_05, WPHX_306_07]) {
    if (!existsSync(path)) failures.push(`required WPHX-306 behavior floor is missing: ${path}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.18 sodium_compat gate failed input validation:\n- ${failures.join("\n- ")}`);
  }

  return { strategyPlan, mediaGate, boundary };
}

function main() {
  const phpFiles = listFiles(SODIUM_ROOT).filter((path) => path.endsWith(".php")).sort();
  const noticeRecords = NOTICE_FILES.map(sourceRecord);
  const sourceFiles = phpFiles.map(sourceRecord);
  const artifactEvidence = artifactRecords(phpFiles.map((path) => path.replace(/^src\//, "")));
  const strategy = readJson(STRATEGY);
  const mediaGates = readJson(MEDIA_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const inputs = validateInputs({ phpFiles, artifactEvidence, strategy, mediaGates, vendorClosure });

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = lintFiles(ORACLE_ROOT, phpFiles);
  const candidateLint = lintFiles(CANDIDATE_ROOT, phpFiles);
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const noIniProbe = noIniHostProbe();

  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  const lintOk = oracleLint.every((entry) => entry.ok) && candidateLint.every((entry) => entry.ok);
  if (!lintOk) throw new Error("sodium_compat PHP lint failed");
  if (!observationsMatch) throw new Error("oracle and candidate sodium_compat observations diverged");

  const markerEvidence = phpFiles.map(sourceMarkers);
  const validationResult = {
    status: "passed",
    source_php_file_count: phpFiles.length,
    notice_file_count: noticeRecords.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_file_count: oracleLint.length,
    candidate_lint_file_count: candidateLint.length,
    native_sodium_extension_loaded: oracleRun.result.observations["sodium:api-reflection-constants"].extension_loaded_sodium,
    direct_pure_php_fallback_forced: true,
    php_no_ini_sodium_extension_off_available: noIniProbe.extension_off_available,
    php_no_ini_sodium_extension_loaded: noIniProbe.result.extension_loaded_sodium,
    php_polyfill_guard_count: markerEvidence.reduce((sum, record) => sum + record.php_polyfill_guard_count, 0),
    fallback_marker_file_count: markerEvidence.filter((record) => record.fallback_marker).length
  };

  const manifest = {
    schema: "wphx.wp-core.sodium-compat-native-fallback-security-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_sodium_compat_native_direct_fallback_security_gate",
    boundary_id: "sodium_compat",
    source_path: "src/wp-includes/sodium_compat",
    distribution_path: "wp-includes/sodium_compat",
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      media_security_archive_gate_manifest: fileRecord(MEDIA_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      wphx_306_password_application_fixture: fileRecord(WPHX_306_05),
      wphx_306_auth_installed_distribution_gate: fileRecord(WPHX_306_07)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.mediaGate.id,
      fallback_policy: inputs.mediaGate.fallback_policy,
      removal_gate: inputs.mediaGate.removal_gate
    },
    source_files: sourceFiles,
    notice_files: noticeRecords,
    artifact_provenance: artifactEvidence,
    package_markers: {
      source_tree_file_count: inputs.boundary.source_tree.file_count,
      php_source_count: inputs.boundary.source_inventory.count,
      distribution_artifact_count: inputs.boundary.distribution_artifacts.count,
      license_provenance: inputs.boundary.license_provenance,
      php_polyfill_guard_count: validationResult.php_polyfill_guard_count,
      fallback_marker_file_count: validationResult.fallback_marker_file_count
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      native_mode:
        "Native mode calls PHP sodium_* functions and ParagonIE_Sodium_Compat with normal fallback behavior on the local PHP host where ext/sodium is loaded.",
      direct_fallback_mode:
        "Direct fallback mode calls ParagonIE_Sodium_Compat methods with disableFallbackForUnitTests=true to force the bundled PHP implementation where sodium_compat supports it.",
      normalization: [
        "Binary crypto outputs are recorded by length and SHA-256 digest only.",
        "Random bytes are not emitted or compared as deterministic fixture output.",
        "Native password hashes are summarized by length, prefix, verify result, and rehash result; salt-bearing hashes are not committed.",
        "Throwable messages are summarized by class, code, and message digest."
      ]
    },
    runs: {
      oracle: oracleRun,
      candidate: candidateRun,
      host_no_ini_probe: noIniProbe,
      lint: {
        oracle: oracleLint,
        candidate: candidateLint
      }
    },
    behavior_floors: [
      {
        id: "wphx-306-05-password-application-fixture",
        manifest: WPHX_306_05,
        role: "WordPress password/application fixture floor for sodium-backed fast hashes and password-family summaries"
      },
      {
        id: "wphx-306-07-auth-installed-distribution-gate",
        manifest: WPHX_306_07,
        role: "installed auth distribution blocker/evidence floor for password/application behavior"
      }
    ],
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_sodium_compat_package_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      native_sodium_on_direct_fallback_differential_recorded: true,
      real_extension_off_installed_runtime_claimed: false,
      haxe_owned_crypto_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_sodium_compat_artifact_retirement_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned sodium_compat or cryptographic runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/sodium_compat.",
      "This gate does not claim copied sodium_compat artifact retirement.",
      "This gate does not prove constant-time behavior or replace security audit requirements for timing-sensitive crypto code.",
      "This gate does not prove installed WordPress behavior on a host where ext/sodium is genuinely unavailable; the local PHP binary keeps ext/sodium loaded even under php -n.",
      "The direct fallback observations are preserved-package evidence using ParagonIE_Sodium_Compat::$disableFallbackForUnitTests, not a WPHX host-primitive implementation."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-18-sodium-compat-native-fallback-security-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_sodium_compat_native_direct_fallback_security_gate",
    boundary_id: "sodium_compat",
    source_paths: phpFiles,
    distribution_paths: phpFiles.map((path) => path.replace(/^src\//, "")),
    emission_strategy: "copied_upstream_vendor_package_with_native_sodium_and_direct_compat_fallback_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    security_review_complete: false,
    notes: [
      "The oracle and candidate roots are regenerated mirrors of upstream WordPress 7.0 sodium_compat.",
      "Direct fallback evidence forces ParagonIE_Sodium_Compat pure-PHP methods where sodium_compat supports them; true extension-off installed hosts remain blocked.",
      "Keep upstream sodium_compat preserved until WPHX-323.22 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "host-native and true extension-off sodium differential evidence",
      "constant-time/security review for equality, verify, random, password, signature, and secretbox boundaries",
      "WPHX-306 auth/password integration pass with candidate overlays",
      "WPHX-323.22 media/security/archive provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-18-sodium-compat-native-fallback-security-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-18-sodium-compat-native-fallback-security-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_sodium_compat_native_direct_fallback_security_gate",
    artifact_scope: "wordpress-7.0-sodium-compat-preserved-package-native-direct-fallback",
    commands: [
      "npm run wp:core:wphx-323-sodium-compat-native-fallback-security",
      "npm run wp:core:wphx-323-sodium-compat-native-fallback-security:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_media_security_archive_gate_manifest: MEDIA_GATES,
      parent_vendor_strategy_manifest: STRATEGY,
      parent_vendor_closure_manifest: VENDOR_CLOSURE
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
  console.log(`recorded ${CASES.length} sodium_compat cases across ${COVERED_SYMBOLS.length} symbols and ${phpFiles.length} PHP files`);
}

main();
