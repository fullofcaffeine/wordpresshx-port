#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { filesUnder } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.28",
  external_ref: "WPHX-305.28",
  title: "Move wpdb query execution bodies beyond the PHP parent shell"
};
const HXML = "fixtures/wp-core/wpdb-query-execution-strategy-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-305-28";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const SHELL = `${OUT_ROOT}/candidate-shell.php`;
const PROBE = `${OUT_ROOT}/query-execution-probe.php`;
const DROPIN_DIR = `${OUT_ROOT}/wp-content`;
const DROPIN = `${DROPIN_DIR}/db.php`;
const DROPIN_PROBE = `${OUT_ROOT}/dropin-probe.php`;
const STRATEGY_PHP = `${HAXE_OUT}/lib/wphx/wp/db/WpdbQueryExecutionStrategy.php`;
const ENTRY_PHP = `${HAXE_OUT}/lib/wphx/fixtures/wp/core/WpdbQueryExecutionStrategyCandidateEntry.php`;
const OUT = "manifests/wp-core/wphx-305-28-wpdb-query-execution-strategy-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-305-28-wpdb-query-execution-strategy-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-305-28-wpdb-query-execution-strategy-candidate.v1.json";
const METHOD_BODY_STRATEGY_CANDIDATE = "manifests/wp-core/wphx-305-27-wpdb-method-body-strategy-candidate.v1.json";
const CLASS_SHELL_RESOURCE_STRATEGY_CANDIDATE =
  "manifests/wp-core/wphx-305-26-wpdb-class-shell-resource-strategy-candidate.v1.json";
const PUBLIC_STATE_EXPANDED_STORAGE_ADAPTER_CANDIDATE = "manifests/wp-core/wphx-305-25-wpdb-public-state-expanded-storage-adapter-candidate.v1.json";
const PUBLIC_STATE_STORAGE_ADAPTER_CANDIDATE = "manifests/wp-core/wphx-305-24-wpdb-public-state-storage-adapter-candidate.v1.json";
const PUBLIC_STATE_DESCRIPTOR_CANDIDATE = "manifests/wp-core/wphx-305-23-wpdb-public-state-descriptor-candidate.v1.json";
const ROW_MATERIALIZATION_CANDIDATE = "manifests/wp-core/wphx-305-21-wpdb-row-materialization-candidate.v1.json";
const MYSQLI_PHPGLOBAL_CANDIDATE = "manifests/wp-core/wphx-305-20-wpdb-mysqli-phpglobal-candidate.v1.json";
const RAW_RESOURCE_CANDIDATE = "manifests/wp-core/wphx-305-15-wpdb-raw-resource-candidate.v1.json";
const MYSQLI_BOUNDARY_CANDIDATE = "manifests/wp-core/wphx-305-16-wpdb-mysqli-boundary-candidate.v1.json";
const RECORDED_AT = "2026-06-21T07:50:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";
const DB_NAME = "wordpresshx_live";
const DB_USER = "root";
const DB_PASSWORD = "wordpresshx-live-password";

const SOURCE_FILES = ["src/wp-includes/class-wpdb.php", "src/wp-includes/load.php", "src/wp-includes/wp-db.php"];

const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/db/WpdbPublicStateDescriptor.hx",
  "src/wphx/wp/db/WpdbPublicStateExpandedStorageAdapter.hx",
  "src/wphx/wp/db/WpdbClassShellStrategy.hx",
  "src/wphx/wp/db/WpdbMethodBodyStrategy.hx",
  "src/wphx/wp/db/WpdbQueryState.hx",
  "src/wphx/wp/db/WpdbNativeExecution.hx",
  "src/wphx/wp/db/WpdbResultPopulation.hx",
  "src/wphx/wp/db/WpdbQueryExecutionStrategy.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/WpdbQueryExecutionStrategyCandidateEntry.hx"
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: options.encoding ?? "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 80
  }).trim();
}

function maybeCommand(commandName, commandArgs, options = {}) {
  try {
    return command(commandName, commandArgs, options);
  } catch {
    return null;
  }
}

function run(commandName, commandArgs, options = {}) {
  const result = spawnSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 80
  });
  return {
    command: [commandName, ...commandArgs].map(quoteCommandArg).join(" "),
    status: result.status,
    signal: result.signal,
    stdout: normalizeOutput(result.stdout),
    stderr: normalizeOutput(result.stderr),
    error: result.error ? result.error.message : null
  };
}

function quoteCommandArg(value) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function normalizeOutput(value) {
  return (value ?? "").trim().slice(0, 12000);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function sourceRecord(path) {
  const repoPath = upstreamPath(path);
  return {
    path,
    repo_path: repoPath,
    bytes: statSync(repoPath).size,
    sha256: sha256File(repoPath)
  };
}

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source)
  };
}

function writeOrCheck(path, text) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== text) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-305-query-execution-strategy-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function phpString(value) {
  return JSON.stringify(value);
}

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function imageRef(image) {
  return `${image.repository}@${image.index_digest}`;
}

function dockerImageInfo(image) {
  const raw = command("docker", ["image", "inspect", imageRef(image)]);
  const [info] = JSON.parse(raw);
  return {
    image: imageRef(image),
    id: info.Id,
    repo_digests: info.RepoDigests ?? [],
    architecture: info.Architecture,
    os: info.Os,
    created: info.Created
  };
}

function dbProbe(port) {
  const code = `
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @new mysqli('127.0.0.1', getenv('WPHX_DB_USER'), getenv('WPHX_DB_PASSWORD'), getenv('WPHX_DB_NAME'), intval(getenv('WPHX_DB_PORT')));
    if ($mysqli->connect_errno) {
      fwrite(STDERR, $mysqli->connect_error . PHP_EOL);
      exit(2);
    }
    $result = $mysqli->query("SELECT VERSION() AS version, @@version_comment AS comment, DATABASE() AS db_name");
    $row = $result->fetch_assoc();
    echo json_encode($row, JSON_UNESCAPED_SLASHES) . PHP_EOL;
  `;
  return JSON.parse(
    command("php", ["-r", code], {
      env: {
        WPHX_DB_USER: DB_USER,
        WPHX_DB_PASSWORD: DB_PASSWORD,
        WPHX_DB_NAME: DB_NAME,
        WPHX_DB_PORT: String(port)
      }
    })
  );
}

function dbRuntimeRecords(lock) {
  return [
    {
      id: "mysql-8.4",
      engine: "mysql",
      image_lock: lock.container_images.mysql_8_4,
      env: {
        MYSQL_ROOT_PASSWORD: DB_PASSWORD,
        MYSQL_DATABASE: DB_NAME,
        MYSQL_ROOT_HOST: "%"
      }
    },
    {
      id: "mariadb-11.8",
      engine: "mariadb",
      image_lock: lock.container_images.mariadb_11_8,
      env: {
        MARIADB_ROOT_PASSWORD: DB_PASSWORD,
        MARIADB_DATABASE: DB_NAME,
        MARIADB_ROOT_HOST: "%"
      }
    }
  ];
}

async function withDbRuntime(runtime, callback) {
  const name = `wordpresshx-wphx-305-28-${runtime.id}-${process.pid}`;
  let containerId = "";
  try {
    const dockerArgs = ["run", "-d", "--rm", "--name", name];
    for (const [key, value] of Object.entries(runtime.env)) {
      dockerArgs.push("-e", `${key}=${value}`);
    }
    dockerArgs.push("-p", "127.0.0.1::3306", imageRef(runtime.image_lock));
    containerId = command("docker", dockerArgs);
    const portOutput = command("docker", ["port", name, "3306/tcp"]);
    const port = Number(portOutput.split(":").at(-1));
    let query = null;
    let lastError = "";
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      try {
        query = dbProbe(port);
        break;
      } catch (error) {
        lastError = error.stderr?.toString?.() || error.message;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!query) {
      throw new Error(`${runtime.id} did not become ready: ${lastError}`);
    }
    return await callback({ port, query, image: dockerImageInfo(runtime.image_lock) });
  } finally {
    if (containerId) {
      try {
        command("docker", ["stop", name], { stdio: ["ignore", "pipe", "ignore"] });
      } catch {
        // Best-effort cleanup for failed startup or interrupted probes.
      }
    }
  }
}

function wordpressProbeStubs() {
  return `
if (!defined('WP_DEBUG')) {
  define('WP_DEBUG', false);
}
if (!defined('WP_DEBUG_DISPLAY')) {
  define('WP_DEBUG_DISPLAY', false);
}
if (!defined('SAVEQUERIES')) {
  define('SAVEQUERIES', false);
}
if (!defined('DB_CHARSET')) {
  define('DB_CHARSET', 'utf8mb4');
}
if (!defined('DB_COLLATE')) {
  define('DB_COLLATE', '');
}
if (!defined('AUTH_SALT')) {
  define('AUTH_SALT', 'wphx-305-28-auth-salt');
}
if (!defined('WP_CONTENT_DIR')) {
  define('WP_CONTENT_DIR', ${phpString(resolve(DROPIN_DIR))});
}
if (!function_exists('apply_filters')) {
  function apply_filters($hook_name, $value) {
    return $value;
  }
}
if (!function_exists('has_filter')) {
  function has_filter($hook_name, $callback = false) {
    return false;
  }
}
if (!function_exists('add_filter')) {
  function add_filter($hook_name, $callback, $priority = 10, $accepted_args = 1): bool {
    return true;
  }
}
if (!function_exists('remove_filter')) {
  function remove_filter($hook_name, $callback, $priority = 10): bool {
    return true;
  }
}
if (!function_exists('absint')) {
  function absint($maybeint): int {
    return abs((int) $maybeint);
  }
}
if (!function_exists('is_multisite')) {
  function is_multisite(): bool {
    return false;
  }
}
if (!function_exists('wp_load_translations_early')) {
  function wp_load_translations_early(): void {
  }
}
if (!function_exists('__')) {
  function __($text) {
    return $text;
  }
}
if (!function_exists('wp_die')) {
  function wp_die($message = ''): void {
    throw new RuntimeException((string) $message);
  }
}
if (!function_exists('did_action')) {
  function did_action($hook_name): int {
    return 0;
  }
}
if (!function_exists('dead_db')) {
  function dead_db(): void {
    throw new RuntimeException('dead_db');
  }
}
if (!function_exists('wp_debug_backtrace_summary')) {
  function wp_debug_backtrace_summary($ignore_class = null, $skip_frames = 0, $pretty = true): string {
    return 'wphx-probe';
  }
}
`;
}

function shellSource() {
  return `<?php
require_once ${phpString(resolve(`${HAXE_OUT}/index.php`))};
${wordpressProbeStubs()}
if (!class_exists('wpdb')) {
  require_once ${phpString(resolve(upstreamPath("src/wp-includes/class-wpdb.php")))};
}

if (!function_exists('wphx_305_28_native_array')) {
  function wphx_305_28_native_array($values): array {
    if ($values instanceof Array_hx) {
      return $values->arr;
    }
    if (is_array($values)) {
      return $values;
    }
    throw new InvalidArgumentException('Expected PHP array or Array_hx.');
  }
}

#[AllowDynamicProperties]
class WPHX_305_28_Wpdb_Query_Execution_Shell extends wpdb {
  public function wphx_set_parent_visible_native_slot(string $name, $value): void {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbClassShellStrategy';
    if (!$strategy::shouldStoreNativeResourceInParentVisibleSlot($name)) {
      throw new InvalidArgumentException('Unsupported native slot.');
    }
    $this->$name = $value;
  }

  public function wphx_reset_lazy_parent_loaded_slot(string $name): void {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbClassShellStrategy';
    if (!$strategy::shouldDelegateLazyReadToParentLoader($name)) {
      throw new InvalidArgumentException('Unsupported lazy slot.');
    }
    $this->$name = null;
  }

  public function flush() {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbMethodBodyStrategy';
    $this->last_result = array();
    $this->col_info = null;
    $this->last_query = null;
    $this->rows_affected = 0;
    $this->num_rows = 0;
    $this->last_error = '';

    $result_was_mysqli_result = $this->result instanceof mysqli_result;
    if ($strategy::shouldFreeMysqliResult($result_was_mysqli_result)) {
      mysqli_free_result($this->result);
      $this->result = null;

      if (!$strategy::shouldDrainMysqliConnection($result_was_mysqli_result, $this->dbh instanceof mysqli)) {
        return;
      }

      while (mysqli_more_results($this->dbh)) {
        mysqli_next_result($this->dbh);
      }
    }
  }

  public function get_col_info($info_type = 'name', $col_offset = -1) {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbMethodBodyStrategy';
    $this->load_col_info();

    if ($this->col_info) {
      if ($strategy::shouldReturnAllColumnInfo((int) $col_offset)) {
        $i = 0;
        $new_array = array();
        foreach ((array) $this->col_info as $col) {
          $new_array[$i] = $col->{$info_type};
          ++$i;
        }
        return $new_array;
      }

      if ($strategy::shouldReturnSingleColumnInfo((int) $col_offset)) {
        return $this->col_info[$col_offset]->{$info_type};
      }
    }
  }

  public function wphx_do_native_query($query): void {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbQueryExecutionStrategy';
    $save_queries_enabled = defined('SAVEQUERIES') && SAVEQUERIES;
    if ($strategy::shouldCaptureQueryLog($save_queries_enabled)) {
      $this->timer_start();
    }

    if ($strategy::shouldExecuteNativeQuery(!empty($this->dbh))) {
      $this->result = mysqli_query($this->dbh, $query);
    }

    $this->num_queries = $strategy::nextQueryCount((int) $this->num_queries);

    if ($strategy::shouldCaptureQueryLog($save_queries_enabled)) {
      $this->log_query($query, $this->timer_stop(), $this->get_caller(), $this->time_start, array());
    }
  }

  public function query($query) {
    $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbQueryExecutionStrategy';
    if ($strategy::shouldShortCircuitNotReady((bool) $this->ready)) {
      $this->check_current_query = true;
      return false;
    }

    $query = apply_filters('query', $query);
    $query_should_run = $strategy::shouldRunFilteredQuery((string) $query);
    if (!$query_should_run) {
      if ($strategy::shouldResetInsertIdForEmptyQuery($query_should_run)) {
        $this->insert_id = 0;
      }
      return false;
    }

    $this->flush();
    $this->func_call = $strategy::funcCallValue((string) $query);

    if ($strategy::shouldRunInvalidTextCheck((bool) $this->check_current_query, $this->check_ascii($query))) {
      $stripped_query = $this->strip_invalid_text_from_query($query);
      $this->flush();
      if ($strategy::shouldRejectStrippedQuery($stripped_query === $query)) {
        $this->insert_id = 0;
        $this->last_query = $query;
        wp_load_translations_early();
        $this->last_error = __('WordPress database error: Could not perform query because it contains invalid data.');
        return false;
      }
    }

    if ($strategy::shouldResetCheckCurrentQueryAfterValidation()) {
      $this->check_current_query = true;
    }

    $this->last_query = $query;
    $this->wphx_do_native_query($query);

    $mysql_errno = 0;
    if ($this->dbh instanceof mysqli) {
      $mysql_errno = mysqli_errno($this->dbh);
    } else {
      $mysql_errno = 2006;
    }

    if ($strategy::shouldAttemptReconnect(empty($this->dbh), (int) $mysql_errno)) {
      if ($this->check_connection()) {
        $this->wphx_do_native_query($query);
      } else {
        $this->insert_id = 0;
        return false;
      }
    }

    if ($this->dbh instanceof mysqli) {
      $this->last_error = mysqli_error($this->dbh);
    } else {
      $this->last_error = __('Unable to retrieve the error message from the database server');
    }

    $query_kind = $strategy::queryKind((string) $query);
    if ($this->last_error) {
      if ($strategy::shouldClearInsertIdAfterError((int) $this->insert_id, $query_kind)) {
        $this->insert_id = 0;
      }
      $this->print_error();
      return false;
    }

    if ($strategy::shouldReturnNativeResult($query_kind)) {
      return $this->result;
    }

    if ($strategy::shouldUseAffectedRows($query_kind)) {
      $this->rows_affected = mysqli_affected_rows($this->dbh);
      if ($strategy::shouldStoreInsertId($query_kind)) {
        $this->insert_id = mysqli_insert_id($this->dbh);
      }
      return $this->rows_affected;
    }

    $num_rows = $strategy::initialSelectedRowCount();
    if ($strategy::shouldPopulateSelectedRows($this->result instanceof mysqli_result)) {
      while ($row = mysqli_fetch_object($this->result)) {
        $this->last_result[$num_rows] = $row;
        $num_rows = $strategy::nextSelectedRowCount((int) $num_rows);
      }
    }

    $this->num_rows = $num_rows;
    return $strategy::selectedRowsReturnValue((int) $num_rows);
  }
}
`;
}

function classShellProbeSource() {
  return `<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', 'stderr');
mysqli_report(MYSQLI_REPORT_OFF);

require_once ${phpString(resolve(SHELL))};

$db_host = $argv[1];
$db_port = (int) $argv[2];
$db_user = $argv[3];
$db_password = $argv[4];
$db_name = $argv[5];
$runtime_id = $argv[6];
$db_host_with_port = $db_host . ':' . $db_port;

function wphx_305_28_normalize_host($value): string {
  return preg_replace('/:\\\\d+$/', ':<port>', (string) $value);
}

function wphx_305_28_value_shape($value): array {
  if (is_array($value)) {
    return array('type' => 'array', 'count' => count($value));
  }
  if (is_object($value)) {
    return array('type' => 'object', 'class' => get_class($value));
  }
  if (is_bool($value)) {
    return array('type' => 'bool', 'value' => $value);
  }
  if (is_int($value)) {
    return array('type' => 'int', 'value' => $value);
  }
  if (is_null($value)) {
    return array('type' => 'null', 'value' => null);
  }
  return array('type' => gettype($value), 'value' => (string) $value);
}

function wphx_305_28_constructor_snapshot($object): array {
  return array(
    'dbuser' => $object->__get('dbuser'),
    'dbpassword_set' => is_string($object->__get('dbpassword')) && '' !== $object->__get('dbpassword'),
    'dbname' => $object->__get('dbname'),
    'dbhost' => wphx_305_28_normalize_host($object->__get('dbhost')),
    'dbh_type' => get_debug_type($object->__get('dbh')),
    'ready' => $object->ready,
    'has_connected' => $object->__get('has_connected'),
    'is_mysql' => $object->is_mysql,
    'use_mysqli' => $object->__get('use_mysqli'),
    'charset' => $object->charset,
    'collate' => $object->collate,
    'result_initial' => wphx_305_28_value_shape($object->__get('result'))
  );
}

function wphx_305_28_col_info_names($col_info): array {
  $names = array();
  foreach ((array) $col_info as $column) {
    $names[] = $column->name;
  }
  return $names;
}

function wphx_305_28_query_snapshot($object): array {
  $return_value = $object->query("SELECT 1 AS alpha, 'two' AS beta");
  $result = $object->__get('result');
  $col_info = $object->__get('col_info');
  $get_col_info_names = $object->get_col_info('name');
  $get_col_info_types = $object->get_col_info('type');
  return array(
    'return_value' => $return_value,
    'result_type' => get_debug_type($result),
    'result_is_mysqli_result' => $result instanceof mysqli_result,
    'col_info_count' => count((array) $col_info),
    'col_info_names' => wphx_305_28_col_info_names($col_info),
    'get_col_info_names' => $get_col_info_names,
    'get_col_info_types' => $get_col_info_types,
    'get_col_info_default' => $object->get_col_info(),
    'get_col_info_single_name' => $object->get_col_info('name', 1),
    'num_rows' => $object->num_rows,
    'last_result_count' => is_array($object->last_result) ? count($object->last_result) : null,
    'last_result_first_row' => is_array($object->last_result) && isset($object->last_result[0])
      ? array('alpha' => (string) $object->last_result[0]->alpha, 'beta' => (string) $object->last_result[0]->beta)
      : null
  );
}

function wphx_305_28_col_info_after_flush_read($object): array {
  try {
    $value = $object->__get('col_info');
    return array('threw' => false, 'shape' => wphx_305_28_value_shape($value));
  } catch (Throwable $throwable) {
    return array('threw' => true, 'class' => get_class($throwable));
  }
}

function wphx_305_28_flush_snapshot($object): array {
  $object->query("SELECT 3 AS flush_alpha, 'four' AS flush_beta");
  $result_before = $object->__get('result');
  $col_info_before = $object->__get('col_info');
  $before = array(
    'result_is_mysqli_result' => $result_before instanceof mysqli_result,
    'col_info_names' => wphx_305_28_col_info_names($col_info_before),
    'last_result_count' => is_array($object->last_result) ? count($object->last_result) : null,
    'last_query_is_string' => is_string($object->last_query),
    'rows_affected' => $object->rows_affected,
    'num_rows' => $object->num_rows,
    'last_error' => $object->last_error
  );
  $object->flush();
  $after = array(
    'last_result_is_array' => is_array($object->last_result),
    'last_result_count' => is_array($object->last_result) ? count($object->last_result) : null,
    'last_query_is_null' => null === $object->last_query,
    'rows_affected' => $object->rows_affected,
    'num_rows' => $object->num_rows,
    'last_error' => $object->last_error,
    'result_shape' => wphx_305_28_value_shape($object->__get('result')),
    'result_is_null' => null === $object->__get('result'),
    'col_info_after_flush_read' => wphx_305_28_col_info_after_flush_read($object)
  );
  return array('before' => $before, 'after' => $after);
}

function wphx_305_28_query_table_name($runtime_id, $class_name): string {
  return 'wphx_305_28_' . preg_replace('/[^a-z0-9_]+/i', '_', strtolower($runtime_id . '_' . $class_name));
}

function wphx_305_28_identifier($name): string {
  return chr(96) . str_replace(chr(96), chr(96) . chr(96), $name) . chr(96);
}

function wphx_305_28_query_execution_snapshot($object, string $runtime_id): array {
  $table = wphx_305_28_identifier(wphx_305_28_query_table_name($runtime_id, get_class($object)));
  $starting_num_queries = (int) $object->num_queries;

  $ready_before = $object->ready;
  $check_current_query_before = $object->check_current_query;
  $object->ready = false;
  $object->check_current_query = false;
  $not_ready_return = $object->query('SELECT 999 AS not_ready_value');
  $not_ready_check_current_query = $object->check_current_query;
  $object->ready = $ready_before;
  $object->check_current_query = $check_current_query_before;

  $object->insert_id = 123;
  $empty_return = $object->query('');
  $empty_insert_id = $object->insert_id;

  $drop_return = $object->query("DROP TABLE IF EXISTS $table");
  $create_return = $object->query("CREATE TABLE $table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(32) NOT NULL UNIQUE, value VARCHAR(32) NOT NULL)");
  $insert_alpha_return = $object->query("INSERT INTO $table (name, value) VALUES ('alpha', 'one')");
  $insert_alpha_id_is_positive = $object->insert_id > 0;
  $insert_beta_return = $object->query("INSERT INTO $table (name, value) VALUES ('beta', 'two')");
  $insert_beta_id_is_positive = $object->insert_id > 0;
  $update_return = $object->query("UPDATE $table SET value = 'two-updated' WHERE name = 'beta'");
  $select_return = $object->query("SELECT name, value FROM $table ORDER BY id ASC");
  $select_num_rows = $object->num_rows;
  $selected_rows = array();
  foreach ((array) $object->last_result as $row) {
    $selected_rows[] = array('name' => (string) $row->name, 'value' => (string) $row->value);
  }

  $duplicate_return = $object->query("INSERT INTO $table (name, value) VALUES ('alpha', 'duplicate')");
  $duplicate_last_error_is_string = is_string($object->last_error) && '' !== $object->last_error;
  $duplicate_insert_id = $object->insert_id;
  $duplicate_last_query_mentions_insert = str_starts_with(strtolower(ltrim((string) $object->last_query)), 'insert');
  $delete_return = $object->query("DELETE FROM $table WHERE name = 'alpha'");
  $drop_after_return = $object->query("DROP TABLE IF EXISTS $table");

  return array(
    'not_ready_return' => $not_ready_return,
    'not_ready_check_current_query' => $not_ready_check_current_query,
    'empty_return' => $empty_return,
    'empty_insert_id' => $empty_insert_id,
    'drop_return' => $drop_return,
    'create_return' => $create_return,
    'insert_alpha_return' => $insert_alpha_return,
    'insert_alpha_id_is_positive' => $insert_alpha_id_is_positive,
    'insert_beta_return' => $insert_beta_return,
    'insert_beta_id_is_positive' => $insert_beta_id_is_positive,
    'update_return' => $update_return,
    'select_return' => $select_return,
    'select_num_rows' => $select_num_rows,
    'selected_rows' => $selected_rows,
    'duplicate_return' => $duplicate_return,
    'duplicate_last_error_is_string' => $duplicate_last_error_is_string,
    'duplicate_insert_id' => $duplicate_insert_id,
    'duplicate_last_query_mentions_insert' => $duplicate_last_query_mentions_insert,
    'delete_return' => $delete_return,
    'drop_after_return' => $drop_after_return,
    'num_queries_increased' => $object->num_queries > $starting_num_queries
  );
}

function wphx_305_28_bridge_snapshot($object): array {
  $strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbClassShellStrategy';
  $mysqli = $object->__get('dbh');
  $result = $mysqli->query("SELECT 7 AS bridge_alpha, 'eight' AS bridge_beta");
  $object->wphx_set_parent_visible_native_slot('result', $result);
  $object->wphx_reset_lazy_parent_loaded_slot('col_info');
  $col_info = $object->__get('col_info');
  return array(
    'dbh_is_mysqli' => $mysqli instanceof mysqli,
    'result_is_mysqli_result' => $object->__get('result') instanceof mysqli_result,
    'col_info_count' => count((array) $col_info),
    'col_info_names' => wphx_305_28_col_info_names($col_info),
    'strategy_result_route' => $strategy::nativeResourceWriteRoute('result'),
    'strategy_col_info_route' => $strategy::lazyReadRoute('col_info')
  );
}

function wphx_305_28_plugin_snapshot($object): array {
  $object->wphx_plugin_extension = 'plugin-value';
  $before_col_meta = wphx_305_28_value_shape($object->__get('col_meta'));
  $object->__set('col_meta', array('blocked' => true));
  $after_col_meta = wphx_305_28_value_shape($object->__get('col_meta'));
  $before_table_charset = wphx_305_28_value_shape($object->__get('table_charset'));
  $object->__set('table_charset', array('blocked' => true));
  $after_table_charset = wphx_305_28_value_shape($object->__get('table_charset'));
  return array(
    'dynamic_property_added' => isset($object->wphx_plugin_extension) && 'plugin-value' === $object->wphx_plugin_extension,
    'dynamic_property_in_object_vars' => array_key_exists('wphx_plugin_extension', get_object_vars($object)),
    'col_meta_write_blocked' => $before_col_meta === $after_col_meta,
    'table_charset_write_blocked' => $before_table_charset === $after_table_charset
  );
}

function wphx_305_28_reflection_shape(string $class_name): array {
  $reflection = new ReflectionClass($class_name);
  $public_properties = array();
  foreach ($reflection->getProperties(ReflectionProperty::IS_PUBLIC) as $property) {
    $public_properties[] = $property->getName();
  }
  sort($public_properties);
  $magic_methods = array();
  foreach (array('__get', '__isset', '__set', '__unset') as $method_name) {
    if ($reflection->hasMethod($method_name) && $reflection->getMethod($method_name)->isPublic()) {
      $magic_methods[] = $method_name;
    }
  }
  return array(
    'public_properties' => $public_properties,
    'public_magic_methods' => $magic_methods,
    'allows_dynamic_properties' => count($reflection->getAttributes(AllowDynamicProperties::class)) > 0
  );
}

$oracle = new wpdb($db_user, $db_password, $db_name, $db_host_with_port);
$candidate = new WPHX_305_28_Wpdb_Query_Execution_Shell($db_user, $db_password, $db_name, $db_host_with_port);

$query_strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbQueryExecutionStrategy';
$method_strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbMethodBodyStrategy';
$class_shell_strategy = '\\\\wphx\\\\wp\\\\db\\\\WpdbClassShellStrategy';
$strategy_contract = array(
  'class_shell_kind' => $class_shell_strategy::classShellKind(),
  'owned_execution_bodies' => wphx_305_28_native_array($query_strategy::ownedExecutionBodies()),
  'query_route' => $query_strategy::executionBodyRoute('query'),
  'do_native_query_route' => $query_strategy::executionBodyRoute('do_native_query'),
  'db_connect_success_route' => $query_strategy::executionBodyRoute('db_connect_success'),
  'check_connection_reconnect_route' => $query_strategy::executionBodyRoute('check_connection_reconnect'),
  'unknown_route' => $query_strategy::executionBodyRoute('prepare'),
  'owns_query' => $query_strategy::ownsExecutionBody('query'),
  'owns_do_native_query' => $query_strategy::ownsExecutionBody('do_native_query'),
  'not_ready_short_circuit_true' => $query_strategy::shouldShortCircuitNotReady(false),
  'not_ready_short_circuit_false' => $query_strategy::shouldShortCircuitNotReady(true),
  'run_filtered_query_true' => $query_strategy::shouldRunFilteredQuery('SELECT 1'),
  'run_filtered_query_false_empty' => $query_strategy::shouldRunFilteredQuery(''),
  'run_filtered_query_false_zero' => $query_strategy::shouldRunFilteredQuery('0'),
  'reset_insert_id_for_empty_query' => $query_strategy::shouldResetInsertIdForEmptyQuery(false),
  'invalid_text_check_true' => $query_strategy::shouldRunInvalidTextCheck(true, false),
  'invalid_text_check_false_when_ascii' => $query_strategy::shouldRunInvalidTextCheck(true, true),
  'reject_stripped_query_true' => $query_strategy::shouldRejectStrippedQuery(false),
  'reset_check_current_query_after_validation' => $query_strategy::shouldResetCheckCurrentQueryAfterValidation(),
  'func_call_value' => $query_strategy::funcCallValue('SELECT 1'),
  'ddl_kind' => $query_strategy::queryKind('CREATE TABLE wphx (id int)'),
  'insert_kind' => $query_strategy::queryKind('INSERT INTO wphx VALUES (1)'),
  'write_kind' => $query_strategy::queryKind('UPDATE wphx SET id = 2'),
  'read_kind' => $query_strategy::queryKind('SELECT 1'),
  'return_native_result_for_ddl' => $query_strategy::shouldReturnNativeResult('ddl'),
  'use_affected_rows_for_insert' => $query_strategy::shouldUseAffectedRows('insert_or_replace'),
  'store_insert_id_for_insert' => $query_strategy::shouldStoreInsertId('insert_or_replace'),
  'clear_insert_id_after_insert_error' => $query_strategy::shouldClearInsertIdAfterError(12, 'insert_or_replace'),
  'attempt_reconnect_for_2006' => $query_strategy::shouldAttemptReconnect(false, 2006),
  'execute_native_query_when_dbh_present' => $query_strategy::shouldExecuteNativeQuery(true),
  'capture_query_log_false' => $query_strategy::shouldCaptureQueryLog(false),
  'next_query_count' => $query_strategy::nextQueryCount(3),
  'populate_selected_rows_for_native_result' => $query_strategy::shouldPopulateSelectedRows(true),
  'initial_selected_row_count' => $query_strategy::initialSelectedRowCount(),
  'next_selected_row_count' => $query_strategy::nextSelectedRowCount(3),
  'selected_rows_return_value' => $query_strategy::selectedRowsReturnValue(4),
  'initialize_charset_on_first_db_connect' => $query_strategy::shouldInitializeCharsetOnDbConnect(false),
  'mark_db_connection_ready_when_dbh_present' => $query_strategy::shouldMarkDbConnectionReady(true),
  'preserves_flush_and_column_info_strategy' => $query_strategy::preservesFlushAndColumnInfoStrategy(),
  'preserves_class_shell_strategy' => $query_strategy::preservesClassShellStrategy(),
  'method_body_flush_route' => $method_strategy::methodBodyRoute('flush'),
  'method_body_get_col_info_route' => $method_strategy::methodBodyRoute('get_col_info')
);

$oracle_constructor = wphx_305_28_constructor_snapshot($oracle);
$candidate_constructor = wphx_305_28_constructor_snapshot($candidate);
$oracle_query = wphx_305_28_query_snapshot($oracle);
$candidate_query = wphx_305_28_query_snapshot($candidate);
$oracle_flush = wphx_305_28_flush_snapshot($oracle);
$candidate_flush = wphx_305_28_flush_snapshot($candidate);
$oracle_query_execution = wphx_305_28_query_execution_snapshot($oracle, $runtime_id);
$candidate_query_execution = wphx_305_28_query_execution_snapshot($candidate, $runtime_id);
$candidate_bridge = wphx_305_28_bridge_snapshot($candidate);
$oracle_plugin = wphx_305_28_plugin_snapshot($oracle);
$candidate_plugin = wphx_305_28_plugin_snapshot($candidate);
$oracle_reflection = wphx_305_28_reflection_shape('wpdb');
$candidate_reflection = wphx_305_28_reflection_shape('WPHX_305_28_Wpdb_Query_Execution_Shell');

$comparisons = array(
  'constructor_side_effects_preserved' => $oracle_constructor === $candidate_constructor,
  'actual_mysqli_query_result_preserved' => $oracle_query === $candidate_query,
  'query_execution_paths_preserved' => $oracle_query_execution === $candidate_query_execution,
  'query_not_ready_and_empty_paths_preserved' => false === $candidate_query_execution['not_ready_return'] && true === $candidate_query_execution['not_ready_check_current_query'] && false === $candidate_query_execution['empty_return'] && 0 === $candidate_query_execution['empty_insert_id'],
  'query_write_and_insert_id_paths_preserved' => 1 === $candidate_query_execution['insert_alpha_return'] && true === $candidate_query_execution['insert_alpha_id_is_positive'] && 1 === $candidate_query_execution['insert_beta_return'] && true === $candidate_query_execution['insert_beta_id_is_positive'] && 1 === $candidate_query_execution['update_return'],
  'query_selected_row_population_preserved' => 2 === $candidate_query_execution['select_return'] && 2 === $candidate_query_execution['select_num_rows'] && $candidate_query_execution['selected_rows'] === array(array('name' => 'alpha', 'value' => 'one'), array('name' => 'beta', 'value' => 'two-updated')),
  'query_error_insert_id_clearing_preserved' => false === $candidate_query_execution['duplicate_return'] && true === $candidate_query_execution['duplicate_last_error_is_string'] && 0 === $candidate_query_execution['duplicate_insert_id'] && true === $candidate_query_execution['duplicate_last_query_mentions_insert'],
  'get_col_info_all_columns_preserved' => $oracle_query['get_col_info_names'] === $candidate_query['get_col_info_names'] && $candidate_query['get_col_info_names'] === array('alpha', 'beta'),
  'get_col_info_single_column_preserved' => $oracle_query['get_col_info_single_name'] === $candidate_query['get_col_info_single_name'] && 'beta' === $candidate_query['get_col_info_single_name'],
  'flush_resource_lifecycle_preserved' => $oracle_flush === $candidate_flush && $candidate_flush['before']['result_is_mysqli_result'] && $candidate_flush['after']['result_is_null'] && 0 === $candidate_flush['after']['last_result_count'],
  'lazy_col_info_materialization_preserved' => $candidate_query['col_info_names'] === array('alpha', 'beta') && $candidate_query['get_col_info_names'] === array('alpha', 'beta'),
  'parent_visible_native_resource_bridge_preserved' => $candidate_bridge['dbh_is_mysqli'] && $candidate_bridge['result_is_mysqli_result'] && $candidate_bridge['col_info_names'] === array('bridge_alpha', 'bridge_beta'),
  'plugin_dynamic_property_preserved' => $oracle_plugin['dynamic_property_added'] === $candidate_plugin['dynamic_property_added'] && $candidate_plugin['dynamic_property_in_object_vars'],
  'protected_magic_write_blocks_preserved' => $oracle_plugin['col_meta_write_blocked'] && $candidate_plugin['col_meta_write_blocked'] && $oracle_plugin['table_charset_write_blocked'] && $candidate_plugin['table_charset_write_blocked'],
  'reflection_public_properties_preserved' => $oracle_reflection['public_properties'] === $candidate_reflection['public_properties'],
  'reflection_public_magic_methods_preserved' => $oracle_reflection['public_magic_methods'] === $candidate_reflection['public_magic_methods'],
  'reflection_dynamic_properties_preserved' => $candidate_reflection['allows_dynamic_properties'] === true,
  'query_execution_routes_present' => $strategy_contract['owns_query'] && $strategy_contract['owns_do_native_query'] && 'typed_haxe_execution_decision_php_abi_body' === $strategy_contract['query_route'] && 'typed_haxe_execution_decision_php_abi_body' === $strategy_contract['do_native_query_route'],
  'query_execution_decisions_preserved' => $strategy_contract['not_ready_short_circuit_true'] && !$strategy_contract['not_ready_short_circuit_false'] && $strategy_contract['run_filtered_query_true'] && !$strategy_contract['run_filtered_query_false_empty'] && !$strategy_contract['run_filtered_query_false_zero'] && $strategy_contract['attempt_reconnect_for_2006'],
  'db_connect_success_decisions_present' => $strategy_contract['initialize_charset_on_first_db_connect'] && $strategy_contract['mark_db_connection_ready_when_dbh_present'],
  'strategy_preserves_method_body_and_class_shell_dependencies' => $strategy_contract['preserves_flush_and_column_info_strategy'] && $strategy_contract['preserves_class_shell_strategy'] && 'typed_haxe_decision_php_abi_body' === $strategy_contract['method_body_flush_route'] && 'typed_haxe_decision_php_abi_body' === $strategy_contract['method_body_get_col_info_route']
);

echo json_encode(
  array(
    'runtime' => $runtime_id,
    'strategy_contract' => $strategy_contract,
    'oracle' => array(
      'constructor' => $oracle_constructor,
      'query' => $oracle_query,
      'flush' => $oracle_flush,
      'query_execution' => $oracle_query_execution,
      'plugin' => $oracle_plugin,
      'reflection' => $oracle_reflection
    ),
    'candidate' => array(
      'constructor' => $candidate_constructor,
      'query' => $candidate_query,
      'flush' => $candidate_flush,
      'query_execution' => $candidate_query_execution,
      'bridge' => $candidate_bridge,
      'plugin' => $candidate_plugin,
      'reflection' => $candidate_reflection
    ),
    'comparisons' => $comparisons,
    'status' => in_array(false, $comparisons, true) ? 'failed' : 'passed'
  ),
  JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
`;
}

function dropinProbeSource() {
  return `<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', 'stderr');
mysqli_report(MYSQLI_REPORT_OFF);

$db_host = $argv[1];
$db_port = (int) $argv[2];
$db_user = $argv[3];
$db_password = $argv[4];
$db_name = $argv[5];
$runtime_id = $argv[6];

define('ABSPATH', ${phpString(`${resolve(UPSTREAM_ROOT)}/src/`)});
define('WPINC', 'wp-includes');
define('WP_CONTENT_DIR', ${phpString(resolve(DROPIN_DIR))});
define('WP_DEBUG', false);
define('WP_DEBUG_DISPLAY', false);
define('SAVEQUERIES', false);
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
define('DB_USER', $db_user);
define('DB_PASSWORD', $db_password);
define('DB_NAME', $db_name);
define('DB_HOST', $db_host . ':' . $db_port);

require_once ${phpString(resolve(upstreamPath("src/wp-includes/load.php")))};
${wordpressProbeStubs()}

require_wp_db();
global $wpdb;

$query_return = $wpdb->query("SELECT 11 AS dropin_alpha, 'twelve' AS dropin_beta");
$result = $wpdb->__get('result');
$col_info = $wpdb->__get('col_info');
$get_col_info_names = $wpdb->get_col_info('name');
$get_col_info_single_name = $wpdb->get_col_info('name', 1);
$col_names = array();
foreach ((array) $col_info as $column) {
  $col_names[] = $column->name;
}
$wpdb->flush();
$flush_result_is_null = null === $wpdb->__get('result');
$flush_last_result_count = is_array($wpdb->last_result) ? count($wpdb->last_result) : null;
$flush_last_query_is_null = null === $wpdb->last_query;
$flush_num_rows = $wpdb->num_rows;
$dropin_table = chr(96) . 'wphx_305_28_dropin_' . preg_replace('/[^a-z0-9_]+/i', '_', strtolower($runtime_id)) . chr(96);
$dropin_drop_return = $wpdb->query("DROP TABLE IF EXISTS $dropin_table");
$dropin_create_return = $wpdb->query("CREATE TABLE $dropin_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(32) NOT NULL UNIQUE, value VARCHAR(32) NOT NULL)");
$dropin_insert_return = $wpdb->query("INSERT INTO $dropin_table (name, value) VALUES ('dropin', 'query-body')");
$dropin_insert_id_is_positive = $wpdb->insert_id > 0;
$dropin_select_return = $wpdb->query("SELECT name, value FROM $dropin_table ORDER BY id ASC");
$dropin_selected_row = isset($wpdb->last_result[0])
  ? array('name' => (string) $wpdb->last_result[0]->name, 'value' => (string) $wpdb->last_result[0]->value)
  : null;
$dropin_duplicate_return = $wpdb->query("INSERT INTO $dropin_table (name, value) VALUES ('dropin', 'duplicate')");
$dropin_duplicate_insert_id = $wpdb->insert_id;
$dropin_duplicate_last_error_is_string = is_string($wpdb->last_error) && '' !== $wpdb->last_error;
$dropin_drop_after_return = $wpdb->query("DROP TABLE IF EXISTS $dropin_table");
$wpdb->wphx_dropin_plugin_property = 'dropin-plugin';

echo json_encode(
  array(
    'runtime' => $runtime_id,
    'class_wpdb_loaded' => class_exists('wpdb'),
    'global_wpdb_set' => isset($wpdb),
    'global_wpdb_class' => is_object($wpdb) ? get_class($wpdb) : null,
    'dropin_replacement_preserved' => is_object($wpdb) && 'WPHX_305_28_Dropin_Wpdb' === get_class($wpdb),
    'constructor_side_effects_available' => is_object($wpdb) && true === $wpdb->ready && true === $wpdb->__get('has_connected') && $wpdb->__get('dbh') instanceof mysqli,
    'actual_result_available' => $result instanceof mysqli_result && 1 === $query_return,
    'lazy_col_info_available' => $col_names === array('dropin_alpha', 'dropin_beta'),
    'method_body_get_col_info_available' => $get_col_info_names === array('dropin_alpha', 'dropin_beta') && 'dropin_beta' === $get_col_info_single_name,
    'method_body_flush_available' => $flush_result_is_null && 0 === $flush_last_result_count && $flush_last_query_is_null && 0 === $flush_num_rows,
    'query_execution_body_available' => true === $dropin_drop_return && true === $dropin_create_return && 1 === $dropin_insert_return && true === $dropin_insert_id_is_positive && 1 === $dropin_select_return && $dropin_selected_row === array('name' => 'dropin', 'value' => 'query-body') && false === $dropin_duplicate_return && 0 === $dropin_duplicate_insert_id && true === $dropin_duplicate_last_error_is_string && true === $dropin_drop_after_return,
    'dynamic_plugin_property_available' => is_object($wpdb) && 'dropin-plugin' === ($wpdb->wphx_dropin_plugin_property ?? null)
  ),
  JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
`;
}

function writeProbeFiles() {
  mkdirSync(OUT_ROOT, { recursive: true });
  mkdirSync(DROPIN_DIR, { recursive: true });
  writeFileSync(SHELL, shellSource());
  writeFileSync(PROBE, classShellProbeSource());
  writeFileSync(
    DROPIN,
    `<?php
require_once ${phpString(resolve(SHELL))};
#[AllowDynamicProperties]
class WPHX_305_28_Dropin_Wpdb extends WPHX_305_28_Wpdb_Query_Execution_Shell {
}
$wpdb = new WPHX_305_28_Dropin_Wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);
`
  );
  writeFileSync(DROPIN_PROBE, dropinProbeSource());
}

function runJsonPhp(path, runtime, port) {
  return JSON.parse(command("php", [path, "127.0.0.1", String(port), DB_USER, DB_PASSWORD, DB_NAME, runtime.id]));
}

function analyzeGeneratedStrategy() {
  const source = readFileSync(STRATEGY_PHP, "utf8");
  return {
    path: STRATEGY_PHP,
    bytes: statSync(STRATEGY_PHP).size,
    sha256: sha256File(STRATEGY_PHP),
    entry_path: ENTRY_PHP,
    entry_sha256: sha256File(ENTRY_PHP),
    generated_php_postprocessing_required: false,
    methods: {
      owned_execution_bodies: /function ownedExecutionBodies\s*\(/.test(source),
      execution_body_route: /function executionBodyRoute\s*\(/.test(source),
      owns_execution_body: /function ownsExecutionBody\s*\(/.test(source),
      should_short_circuit_not_ready: /function shouldShortCircuitNotReady\s*\(/.test(source),
      should_run_filtered_query: /function shouldRunFilteredQuery\s*\(/.test(source),
      should_reset_insert_id_for_empty_query: /function shouldResetInsertIdForEmptyQuery\s*\(/.test(source),
      should_run_invalid_text_check: /function shouldRunInvalidTextCheck\s*\(/.test(source),
      should_reject_stripped_query: /function shouldRejectStrippedQuery\s*\(/.test(source),
      should_reset_check_current_query_after_validation: /function shouldResetCheckCurrentQueryAfterValidation\s*\(/.test(source),
      func_call_value: /function funcCallValue\s*\(/.test(source),
      query_kind: /function queryKind\s*\(/.test(source),
      should_return_native_result: /function shouldReturnNativeResult\s*\(/.test(source),
      should_use_affected_rows: /function shouldUseAffectedRows\s*\(/.test(source),
      should_store_insert_id: /function shouldStoreInsertId\s*\(/.test(source),
      should_clear_insert_id_after_error: /function shouldClearInsertIdAfterError\s*\(/.test(source),
      should_attempt_reconnect: /function shouldAttemptReconnect\s*\(/.test(source),
      should_execute_native_query: /function shouldExecuteNativeQuery\s*\(/.test(source),
      should_capture_query_log: /function shouldCaptureQueryLog\s*\(/.test(source),
      next_query_count: /function nextQueryCount\s*\(/.test(source),
      should_populate_selected_rows: /function shouldPopulateSelectedRows\s*\(/.test(source),
      initial_selected_row_count: /function initialSelectedRowCount\s*\(/.test(source),
      next_selected_row_count: /function nextSelectedRowCount\s*\(/.test(source),
      selected_rows_return_value: /function selectedRowsReturnValue\s*\(/.test(source),
      should_initialize_charset_on_db_connect: /function shouldInitializeCharsetOnDbConnect\s*\(/.test(source),
      should_mark_db_connection_ready: /function shouldMarkDbConnectionReady\s*\(/.test(source),
      preserves_flush_and_column_info_strategy: /function preservesFlushAndColumnInfoStrategy\s*\(/.test(source),
      preserves_class_shell_strategy: /function preservesClassShellStrategy\s*\(/.test(source)
    }
  };
}

function runtimeSummary(runtime, probe, dropinProbe, image, query) {
  return {
    id: runtime.id,
    engine: runtime.engine,
    image,
    server: {
      version: query.version,
      comment: query.comment,
      db_name: query.db_name
    },
    class_shell_probe: probe,
    dropin_probe: dropinProbe,
    passed:
      probe.status === "passed" &&
      Object.values(probe.comparisons).every(Boolean) &&
      dropinProbe.dropin_replacement_preserved === true &&
      dropinProbe.constructor_side_effects_available === true &&
      dropinProbe.actual_result_available === true &&
      dropinProbe.lazy_col_info_available === true &&
      dropinProbe.method_body_get_col_info_available === true &&
      dropinProbe.method_body_flush_available === true &&
      dropinProbe.query_execution_body_available === true &&
      dropinProbe.dynamic_plugin_property_available === true
  };
}

function sanitizedRunCommand(path, runtime) {
  return `php ${path} 127.0.0.1 <port> ${DB_USER} <password> ${DB_NAME} ${runtime.id}`;
}

function ownershipManifest(manifestSha, upstreamDigest, runtimes) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wpdb-query-execution-strategy-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "module",
      name: "wpdb query execution strategy",
      area: "wp-includes",
      public_contract:
        "WordPress-compatible wpdb remains a PHP-visible class/global while typed Haxe owns the decision model for selected query execution paths. WPHX-305.28 proves query() readiness, empty-query, native execution, reconnect, DDL/write/read return, affected rows, insert id, selected-row population, and error insert-id clearing behavior through a PHP ABI subclass that preserves declared public properties, dynamic plugin properties, magic accessors, native mysqli handles/results, lazy col_info materialization, constructor/db_connect side effects, WPHX-305.27 flush()/get_col_info() behavior, and require_wp_db()/db.php replacement behavior."
    },
    ownership_state: "haxe_parity_candidate",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: [
      HXML,
      "src/wphx/wp/db/WpdbQueryExecutionStrategy.hx",
      "fixtures/wp-core/src/wphx/fixtures/wp/core/WpdbQueryExecutionStrategyCandidateEntry.hx",
      "tools/wp-core/run-wpdb-query-execution-strategy-candidate.mjs",
      OUT,
      RECEIPT
    ],
    generated_paths: [HAXE_OUT, SHELL, PROBE, DROPIN, DROPIN_PROBE, OUT, OWNERSHIP, RECEIPT],
    typed_haxe_ownership: {
      strategy: "wphx.wp.db.WpdbQueryExecutionStrategy",
      owns: [
        "owned wpdb execution-body list for query(), native query dispatch, db_connect success, and reconnect decisions",
        "query() not-ready and empty-query branch decisions",
        "query() invalid-text validation branch decisions",
        "query() DDL/write/read return path classification",
        "query() affected-row, insert-id, selected-row, and duplicate-error insert-id clearing decisions",
        "native query dispatch and query-count/logging decisions",
        "db_connect success-side charset/ready decisions",
        "WPHX-305.27 flush()/get_col_info() dependency checks",
        "class-shell/plugin ABI dependency checks"
      ],
      does_not_yet_own: [
        "full db_connect() socket/IPv6/native connection construction",
        "prepare(), dbDelta(), and other broad wpdb method bodies",
        "all upstream PHPUnit wpdb/dbDelta/option cases",
        "packaged distribution bootstrap"
      ]
    },
    php_abi_shell: {
      preserved: [
        "class wpdb remains PHP-visible",
        "global $wpdb can be supplied by wp-content/db.php",
        "constructor establishes a live mysqli connection",
        "dbh/result are parent-visible native PHP slots",
        "col_info remains lazily materialized by WordPress parent logic",
        "declared public property reflection shape matches wpdb",
        "dynamic plugin properties remain available",
        "protected magic writes remain blocked"
      ],
      proof:
        `WPHX-305.28 provisions ${runtimes.map((runtime) => runtime.id).join(" and ")} from locked images and compares a WPHX_305_28_Wpdb_Query_Execution_Shell subclass against WordPress wpdb for query() execution paths, get_col_info() paths, flush() resource cleanup, constructor/db_connect side effects, mysqli_result, lazy col_info, plugin mutation, reflection shape, protected magic write blocks, and db.php replacement.`
    },
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-305-query-execution-strategy-candidate",
        "npm run wp:core:wphx-305-query-execution-strategy-candidate:check",
        "npm run wp:core:wphx-305-method-body-strategy-candidate:check",
        "npm run wp:core:wphx-305-class-shell-resource-strategy-candidate:check",
        "npm run wp:core:wphx-305-public-state-expanded-storage-adapter-candidate:check",
        "npm run wp:core:wphx-305-public-state-storage-adapter-candidate:check",
        "npm run wp:core:wphx-305-public-state-descriptor-candidate:check",
        "npm run wp:core:wphx-305-row-materialization-candidate:check",
        "npm run wp:core:wphx-305-mysqli-phpglobal-candidate:check",
        "npm run format:haxe:check",
        "npm run haxe:escape-hatches:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: [
        "receipt:wphx-305-28-wpdb-query-execution-strategy-candidate",
        "receipt:wphx-305-27-wpdb-method-body-strategy-candidate",
        "receipt:wphx-305-26-wpdb-class-shell-resource-strategy-candidate",
        "receipt:wphx-305-25-wpdb-public-state-expanded-storage-adapter-candidate",
        "receipt:wphx-305-24-wpdb-public-state-storage-adapter-candidate",
        "receipt:wphx-305-23-wpdb-public-state-descriptor-candidate",
        "receipt:wphx-305-21-wpdb-row-materialization-candidate",
        "receipt:wphx-305-20-wpdb-mysqli-phpglobal-candidate"
      ],
      manifest_digest: manifestSha
    }
  };
}

const methodBodyStrategyCandidate = readJson(METHOD_BODY_STRATEGY_CANDIDATE);
const classShellResourceStrategyCandidate = readJson(CLASS_SHELL_RESOURCE_STRATEGY_CANDIDATE);
const publicStateExpandedStorageAdapterCandidate = readJson(PUBLIC_STATE_EXPANDED_STORAGE_ADAPTER_CANDIDATE);
const publicStateStorageAdapterCandidate = readJson(PUBLIC_STATE_STORAGE_ADAPTER_CANDIDATE);
const publicStateDescriptorCandidate = readJson(PUBLIC_STATE_DESCRIPTOR_CANDIDATE);
const rowMaterializationCandidate = readJson(ROW_MATERIALIZATION_CANDIDATE);
const mysqliPhpGlobalCandidate = readJson(MYSQLI_PHPGLOBAL_CANDIDATE);
const rawResourceCandidate = readJson(RAW_RESOURCE_CANDIDATE);
const mysqliBoundaryCandidate = readJson(MYSQLI_BOUNDARY_CANDIDATE);
const toolchainLock = readJson("toolchain.lock.json");
const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const haxeVersion = command("haxe", ["--version"]);

if (!maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"])) {
  console.error(JSON.stringify({ status: "failed", error: "docker server unavailable; WPHX-305.28 requires live DB containers" }, null, 2));
  process.exit(1);
}

rmSync(OUT_ROOT, { recursive: true, force: true });
const compile = run("haxe", [HXML]);
if (compile.status !== 0) {
  console.error(JSON.stringify({ status: "failed", phase: "haxe_compile", compile }, null, 2));
  process.exit(1);
}

writeProbeFiles();
const generatedStrategy = analyzeGeneratedStrategy();
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) => !audit.contains_dynamic && !audit.contains_untyped && !audit.contains_cast && !audit.contains_php_syntax_code
);
const generatedMethodsPresent = Object.values(generatedStrategy.methods).every(Boolean);
const dbRuntimes = dbRuntimeRecords(toolchainLock);
const runtimeResults = [];

for (const runtime of dbRuntimes) {
  const result = await withDbRuntime(runtime, async ({ port, query, image }) => {
    const classShellProbe = runJsonPhp(PROBE, runtime, port);
    const dropinProbe = runJsonPhp(DROPIN_PROBE, runtime, port);
    return runtimeSummary(runtime, classShellProbe, dropinProbe, image, query);
  });
  runtimeResults.push(result);
}

const strategyContract = runtimeResults[0]?.class_shell_probe?.strategy_contract ?? {};
const expectedOwnedExecutionBodies = ["check_connection_reconnect", "db_connect_success", "do_native_query", "query"];
const strategyMatchesPlan = {
  class_shell_kind_is_php_abi_subclass: strategyContract.class_shell_kind === "php_abi_subclass_shell",
  owned_execution_bodies_match_expected: arraysEqual(sorted(strategyContract.owned_execution_bodies ?? []), sorted(expectedOwnedExecutionBodies)),
  execution_body_routes_match_expected:
    strategyContract.query_route === "typed_haxe_execution_decision_php_abi_body" &&
    strategyContract.do_native_query_route === "typed_haxe_execution_decision_php_abi_body" &&
    strategyContract.db_connect_success_route === "typed_haxe_execution_decision_php_abi_body" &&
    strategyContract.check_connection_reconnect_route === "typed_haxe_execution_decision_php_abi_body" &&
    strategyContract.unknown_route === "unknown",
  owns_expected_execution_bodies: strategyContract.owns_query === true && strategyContract.owns_do_native_query === true,
  early_query_decisions_match_expected:
    strategyContract.not_ready_short_circuit_true === true &&
    strategyContract.not_ready_short_circuit_false === false &&
    strategyContract.run_filtered_query_true === true &&
    strategyContract.run_filtered_query_false_empty === false &&
    strategyContract.run_filtered_query_false_zero === false &&
    strategyContract.reset_insert_id_for_empty_query === true,
  invalid_text_decisions_match_expected:
    strategyContract.invalid_text_check_true === true &&
    strategyContract.invalid_text_check_false_when_ascii === false &&
    strategyContract.reject_stripped_query_true === true &&
    strategyContract.reset_check_current_query_after_validation === true,
  query_kind_decisions_match_expected:
    strategyContract.ddl_kind === "ddl" &&
    strategyContract.insert_kind === "insert_or_replace" &&
    strategyContract.write_kind === "write" &&
    strategyContract.read_kind === "read" &&
    strategyContract.return_native_result_for_ddl === true &&
    strategyContract.use_affected_rows_for_insert === true &&
    strategyContract.store_insert_id_for_insert === true &&
    strategyContract.clear_insert_id_after_insert_error === true,
  native_execution_decisions_match_expected:
    strategyContract.attempt_reconnect_for_2006 === true &&
    strategyContract.execute_native_query_when_dbh_present === true &&
    strategyContract.capture_query_log_false === false &&
    strategyContract.next_query_count === 4,
  selected_row_decisions_match_expected:
    strategyContract.populate_selected_rows_for_native_result === true &&
    strategyContract.initial_selected_row_count === 0 &&
    strategyContract.next_selected_row_count === 4 &&
    strategyContract.selected_rows_return_value === 4,
  db_connect_success_decisions_match_expected:
    strategyContract.initialize_charset_on_first_db_connect === true &&
    strategyContract.mark_db_connection_ready_when_dbh_present === true,
  preserves_method_body_and_class_shell_dependencies:
    strategyContract.preserves_flush_and_column_info_strategy === true &&
    strategyContract.preserves_class_shell_strategy === true &&
    strategyContract.method_body_flush_route === "typed_haxe_decision_php_abi_body" &&
    strategyContract.method_body_get_col_info_route === "typed_haxe_decision_php_abi_body"
};

const runtimeResultsPassed = runtimeResults.every((result) => result.passed);
const predecessorStatuses = {
  method_body_strategy: methodBodyStrategyCandidate.validation_result?.status ?? null,
  class_shell_resource_strategy: classShellResourceStrategyCandidate.validation_result?.status ?? null,
  public_state_expanded_storage_adapter: publicStateExpandedStorageAdapterCandidate.validation_result?.status ?? null,
  public_state_storage_adapter: publicStateStorageAdapterCandidate.validation_result?.status ?? null,
  public_state_descriptor: publicStateDescriptorCandidate.validation_result?.status ?? null,
  row_materialization: rowMaterializationCandidate.validation_result?.status ?? null,
  mysqli_phpglobal: mysqliPhpGlobalCandidate.validation_result?.status ?? null,
  raw_resource: rawResourceCandidate.validation_result?.status ?? null,
  mysqli_boundary: mysqliBoundaryCandidate.validation_result?.status ?? null
};
const predecessorsPassed = Object.values(predecessorStatuses).every((status) => status === "passed");
const validationStatus =
  runtimeResultsPassed &&
  Object.values(strategyMatchesPlan).every(Boolean) &&
  sourceEscapeAuditPassed &&
  generatedMethodsPresent &&
  predecessorsPassed
    ? "passed"
    : "failed";

const manifest = {
  schema: "wphx.wp-core-wpdb-query-execution-strategy-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-wpdb-query-execution-strategy-candidate.mjs",
  inputs: {
    method_body_strategy_candidate_manifest: inputRecord(METHOD_BODY_STRATEGY_CANDIDATE),
    public_state_expanded_storage_adapter_candidate_manifest: inputRecord(PUBLIC_STATE_EXPANDED_STORAGE_ADAPTER_CANDIDATE),
    class_shell_resource_strategy_candidate_manifest: inputRecord(CLASS_SHELL_RESOURCE_STRATEGY_CANDIDATE),
    public_state_storage_adapter_candidate_manifest: inputRecord(PUBLIC_STATE_STORAGE_ADAPTER_CANDIDATE),
    public_state_descriptor_candidate_manifest: inputRecord(PUBLIC_STATE_DESCRIPTOR_CANDIDATE),
    row_materialization_candidate_manifest: inputRecord(ROW_MATERIALIZATION_CANDIDATE),
    mysqli_phpglobal_candidate_manifest: inputRecord(MYSQLI_PHPGLOBAL_CANDIDATE),
    raw_resource_candidate_manifest: inputRecord(RAW_RESOURCE_CANDIDATE),
    mysqli_boundary_candidate_manifest: inputRecord(MYSQLI_BOUNDARY_CANDIDATE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    haxe_sources: HAXE_SOURCES.map(inputRecord),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "typed_haxe_wpdb_query_execution_strategy",
    selected_strategy: "typed-wpdb-query-execution-strategy-and-live-php-abi-shell",
    haxe_version: haxeVersion,
    locked_haxe_version: toolchainLock.tools.haxe.version,
    locked_php_cli: toolchainLock.tools.php_cli.executable,
    generated_haxe_files: filesUnder(HAXE_OUT),
    haxe_query_execution_strategy: {
      source: "src/wphx/wp/db/WpdbQueryExecutionStrategy.hx",
      generated_php: generatedStrategy,
      source_escape_audits: haxeSourceAudits,
      strategy_matches_plan: strategyMatchesPlan,
      runtime_results: runtimeResults.map((result) => ({
        id: result.id,
        engine: result.engine,
        image: result.image,
        server: result.server,
        class_shell_probe_status: result.class_shell_probe.status,
        dropin_probe_status: result.dropin_probe.dropin_replacement_preserved ? "passed" : "failed",
        comparisons: result.class_shell_probe.comparisons,
        dropin_probe: result.dropin_probe,
        passed: result.passed
      }))
    },
    public_abi_policy: {
      preserve_class_name_wpdb: true,
      preserve_global_wpdb: true,
      preserve_db_php_dropin_replacement: true,
      preserve_declared_public_properties: true,
      preserve_dynamic_properties: true,
      preserve_magic_accessors: true,
      preserve_protected_magic_write_blocks: true,
      preserve_constructor_side_effects: true,
      preserve_actual_mysqli_resource_behavior: true,
      preserve_lazy_col_info_materialization: true,
      raw_php_syntax_code_used_in_haxe: false,
      generated_php_postprocessing_required: false
    },
    inherited_candidates: {
      method_body_strategy: {
        manifest: METHOD_BODY_STRATEGY_CANDIDATE,
        validation_result: methodBodyStrategyCandidate.validation_result
      },
      class_shell_resource_strategy: {
        manifest: CLASS_SHELL_RESOURCE_STRATEGY_CANDIDATE,
        validation_result: classShellResourceStrategyCandidate.validation_result
      },
      public_state_expanded_storage_adapter: {
        manifest: PUBLIC_STATE_EXPANDED_STORAGE_ADAPTER_CANDIDATE,
        validation_result: publicStateExpandedStorageAdapterCandidate.validation_result
      },
      public_state_storage_adapter: {
        manifest: PUBLIC_STATE_STORAGE_ADAPTER_CANDIDATE,
        validation_result: publicStateStorageAdapterCandidate.validation_result
      },
      public_state_descriptor: {
        manifest: PUBLIC_STATE_DESCRIPTOR_CANDIDATE,
        validation_result: publicStateDescriptorCandidate.validation_result
      },
      row_materialization: {
        manifest: ROW_MATERIALIZATION_CANDIDATE,
        validation_result: rowMaterializationCandidate.validation_result
      },
      mysqli_phpglobal: {
        manifest: MYSQLI_PHPGLOBAL_CANDIDATE,
        validation_result: mysqliPhpGlobalCandidate.validation_result
      }
    },
    closes_gaps_from: [
      {
        manifest: METHOD_BODY_STRATEGY_CANDIDATE,
        gap: "query-and-db-connect-method-bodies-not-yet-haxe-owned",
        resolution:
          "WPHX-305.28 builds on the typed Haxe class-shell/resource/bootstrap route policy and WPHX-305.27 method-body proof by moving query() execution decisions beyond the WordPress PHP parent into typed Haxe-owned strategy decisions while preserving the live PHP ABI shell."
      },
      {
        manifest: ROW_MATERIALIZATION_CANDIDATE,
        gap: "full-wpdb-replacement-dropin-behavior-not-yet-proven",
        resolution:
          "WPHX-305.28 keeps the row materialization/live mysqli gates green and proves db.php replacement/global $wpdb behavior reaches the Haxe-owned query(), get_col_info(), and flush() decisions."
      }
    ],
    remaining_gaps: [
      {
        id: "full-db-connect-native-construction-not-yet-haxe-owned",
        owner: "WPHX-305.29",
        detail:
          "WPHX-305.28 owns query() execution and db_connect success-side decisions, but the full db_connect() host parsing, socket/IPv6 handling, mysqli_init/real_connect construction, bail behavior, SQL mode setup, and database selection sequence still rely on the WordPress PHP parent shell."
      },
      {
        id: "packaged-distribution-bootstrap-not-yet-owned",
        owner: "future WPHX-305 distribution workset",
        detail:
          "The probe proves require_wp_db()/db.php replacement semantics in isolation. Packaging the replacement into a distributable WordPress core layout remains future distribution work."
      },
      {
        id: "full-upstream-phpunit-not-yet-ported",
        owner: "WPHX-305",
        detail:
          "Storage ABI probes and live DB candidate gates cover this slice, but full upstream wpdb/dbDelta/option PHPUnit parity remains a domain closure requirement."
      }
    ]
  },
  validation_result: {
    status: validationStatus,
    selected_strategy: "typed-wpdb-query-execution-strategy-and-live-php-abi-shell",
    db_runtimes: runtimeResults.length,
    runtime_results_passed: runtimeResultsPassed,
    constructor_side_effects_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.constructor_side_effects_preserved),
    actual_mysqli_query_result_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.actual_mysqli_query_result_preserved),
    query_execution_paths_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.query_execution_paths_preserved),
    query_not_ready_and_empty_paths_preserved: runtimeResults.every(
      (result) => result.class_shell_probe.comparisons.query_not_ready_and_empty_paths_preserved
    ),
    query_write_and_insert_id_paths_preserved: runtimeResults.every(
      (result) => result.class_shell_probe.comparisons.query_write_and_insert_id_paths_preserved
    ),
    query_selected_row_population_preserved: runtimeResults.every(
      (result) => result.class_shell_probe.comparisons.query_selected_row_population_preserved
    ),
    query_error_insert_id_clearing_preserved: runtimeResults.every(
      (result) => result.class_shell_probe.comparisons.query_error_insert_id_clearing_preserved
    ),
    get_col_info_all_columns_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.get_col_info_all_columns_preserved),
    get_col_info_single_column_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.get_col_info_single_column_preserved),
    flush_resource_lifecycle_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.flush_resource_lifecycle_preserved),
    lazy_col_info_materialization_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.lazy_col_info_materialization_preserved),
    parent_visible_native_resource_bridge_preserved: runtimeResults.every(
      (result) => result.class_shell_probe.comparisons.parent_visible_native_resource_bridge_preserved
    ),
    plugin_dynamic_property_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.plugin_dynamic_property_preserved),
    protected_magic_write_blocks_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.protected_magic_write_blocks_preserved),
    reflection_public_properties_preserved: runtimeResults.every((result) => result.class_shell_probe.comparisons.reflection_public_properties_preserved),
    require_wp_db_dropin_replacement_preserved: runtimeResults.every((result) => result.dropin_probe.dropin_replacement_preserved),
    dropin_method_body_get_col_info_preserved: runtimeResults.every((result) => result.dropin_probe.method_body_get_col_info_available),
    dropin_method_body_flush_preserved: runtimeResults.every((result) => result.dropin_probe.method_body_flush_available),
    dropin_query_execution_body_preserved: runtimeResults.every((result) => result.dropin_probe.query_execution_body_available),
    source_escape_audit_passed: sourceEscapeAuditPassed,
    generated_methods_present: generatedMethodsPresent,
    strategy_matches_plan: Object.values(strategyMatchesPlan).every(Boolean),
    predecessor_statuses: predecessorStatuses
  }
};

if (validationStatus !== "passed") {
  console.error(JSON.stringify({ status: "failed", validation_result: manifest.validation_result }, null, 2));
  process.exit(1);
}

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest, dbRuntimes), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-305-28-wpdb-query-execution-strategy-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "typed Haxe wpdb query execution strategy candidate manifest"
    },
    {
      path: OWNERSHIP,
      role: "query execution strategy ownership manifest"
    },
    {
      path: "src/wphx/wp/db/WpdbQueryExecutionStrategy.hx",
      role: "typed Haxe wpdb query execution decision policy"
    },
    {
      path: "src/wphx/wp/db/WpdbClassShellStrategy.hx",
      role: "predecessor class-shell/native-resource boundary used by the query execution strategy"
    },
    {
      path: "tools/wp-core/run-wpdb-query-execution-strategy-candidate.mjs",
      role: "live query execution/resource/drop-in proof runner"
    },
    {
      path: "src/wphx/wp/db/WpdbPublicStateExpandedStorageAdapter.hx",
      role: "predecessor expanded public-state adapter kept green"
    },
    {
      path: "src/wphx/wp/db/WpdbMysqliExecution.hx",
      role: "predecessor typed Haxe mysqli @:phpGlobal execution implementation kept green"
    },
    {
      path: "src/wphx/wp/db/WpdbRowMaterialization.hx",
      role: "predecessor typed Haxe row materialization implementation kept green"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-305-query-execution-strategy-candidate",
    "npm run wp:core:wphx-305-query-execution-strategy-candidate:check",
    "npm run wp:core:wphx-305-method-body-strategy-candidate:check",
    "npm run wp:core:wphx-305-class-shell-resource-strategy-candidate:check",
    "npm run wp:core:wphx-305-public-state-expanded-storage-adapter-candidate:check",
    "npm run wp:core:wphx-305-public-state-storage-adapter-candidate:check",
    "npm run wp:core:wphx-305-public-state-descriptor-candidate:check",
    "npm run wp:core:wphx-305-row-materialization-candidate:check",
    "npm run wp:core:wphx-305-mysqli-phpglobal-candidate:check",
    "npm run format:haxe:check",
    "npm run haxe:escape-hatches:check",
    "npm run beads:validate",
    "npm run receipts:validate"
  ],
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
      selected_strategy: manifest.validation_result.selected_strategy,
      db_runtimes: manifest.validation_result.db_runtimes,
      constructor_side_effects_preserved: manifest.validation_result.constructor_side_effects_preserved,
      actual_mysqli_query_result_preserved: manifest.validation_result.actual_mysqli_query_result_preserved,
      query_execution_paths_preserved: manifest.validation_result.query_execution_paths_preserved,
      query_write_and_insert_id_paths_preserved: manifest.validation_result.query_write_and_insert_id_paths_preserved,
      query_selected_row_population_preserved: manifest.validation_result.query_selected_row_population_preserved,
      query_error_insert_id_clearing_preserved: manifest.validation_result.query_error_insert_id_clearing_preserved,
      get_col_info_all_columns_preserved: manifest.validation_result.get_col_info_all_columns_preserved,
      get_col_info_single_column_preserved: manifest.validation_result.get_col_info_single_column_preserved,
      flush_resource_lifecycle_preserved: manifest.validation_result.flush_resource_lifecycle_preserved,
      lazy_col_info_materialization_preserved: manifest.validation_result.lazy_col_info_materialization_preserved,
      parent_visible_native_resource_bridge_preserved: manifest.validation_result.parent_visible_native_resource_bridge_preserved,
      require_wp_db_dropin_replacement_preserved: manifest.validation_result.require_wp_db_dropin_replacement_preserved
    },
    null,
    2
  )
);
