#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const HXML = "fixtures/php-facade/f1-global-function.hxml";
const OUT_ROOT = "build/php-facade";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const SHELL = `${OUT_ROOT}/generated/wp-includes/plugin.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const ORACLE = "fixtures/php-facade/oracle/add-filter.php";
const OUT = "manifests/php-facade/wphx-102-f1-global-function.v1.json";
const RECORDED_AT = "2026-06-20T05:25:00Z";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs) {
  try {
    return command(commandName, commandArgs);
  } catch {
    return null;
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

function filesUnder(dir) {
  return walk(dir)
    .map((path) => ({
      path: relative(dir, path),
      bytes: statSync(path).size,
      sha256: sha256(path)
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function writeGeneratedShell() {
  mkdirSync(dirname(SHELL), { recursive: true });
  writeFileSync(
    SHELL,
    `<?php

if ( ! defined( 'WPHX_F1_FACADE_BOOTSTRAPPED' ) ) {
\tdefine( 'WPHX_F1_FACADE_BOOTSTRAPPED', true );
\t$wphx_f1_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_f1_lib );
\tspl_autoload_register(
\t\tfunction ( $class ) {
\t\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\t\tif ( $file ) {
\t\t\t\tinclude_once $file;
\t\t\t}
\t\t}
\t);
\t\\php\\Boot::__hx__init();
}

if ( ! function_exists( 'add_filter' ) ) {
\tfunction add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t\treturn \\wphx\\fixtures\\php\\facade\\FacadeKernel::addFilter( $hook_name, $callback, $priority, $accepted_args );
\t}
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$shell = $argv[2];

$before = function_exists( 'add_filter' );
require $shell;
$after = function_exists( 'add_filter' );
require $shell;
$after_second_require = function_exists( 'add_filter' );

$reflection = new ReflectionFunction( 'add_filter' );
$params = array();
foreach ( $reflection->getParameters() as $parameter ) {
\t$params[] = array(
\t\t'name' => $parameter->getName(),
\t\t'position' => $parameter->getPosition(),
\t\t'isOptional' => $parameter->isOptional(),
\t\t'hasDefault' => $parameter->isDefaultValueAvailable(),
\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t'hasType' => $parameter->hasType(),
\t\t'isPassedByReference' => $parameter->isPassedByReference(),
\t\t'isVariadic' => $parameter->isVariadic(),
\t);
}

$return = add_filter( 'the_content', function ( $value ) { return $value; }, 10, 1 );
$snapshot = 'generated' === $mode
\t? \\wphx\\fixtures\\php\\facade\\FacadeKernel::snapshot()
\t: wphx_f1_snapshot();

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'beforeFunctionExists' => $before,
\t\t'afterFunctionExists' => $after,
\t\t'afterSecondRequireFunctionExists' => $after_second_require,
\t\t'name' => $reflection->getName(),
\t\t'numberOfParameters' => $reflection->getNumberOfParameters(),
\t\t'numberOfRequiredParameters' => $reflection->getNumberOfRequiredParameters(),
\t\t'returnsReference' => $reflection->returnsReference(),
\t\t'hasReturnType' => $reflection->hasReturnType(),
\t\t'parameters' => $params,
\t\t'callReturn' => $return,
\t\t'snapshot' => json_decode( $snapshot, true ),
\t),
\tJSON_UNESCAPED_SLASHES
);
`
  );
}

function normalizeProbe(result) {
  return {
    beforeFunctionExists: result.beforeFunctionExists,
    afterFunctionExists: result.afterFunctionExists,
    afterSecondRequireFunctionExists: result.afterSecondRequireFunctionExists,
    name: result.name,
    numberOfParameters: result.numberOfParameters,
    numberOfRequiredParameters: result.numberOfRequiredParameters,
    returnsReference: result.returnsReference,
    hasReturnType: result.hasReturnType,
    parameters: result.parameters,
    callReturn: result.callReturn,
    snapshot: result.snapshot
  };
}

function runProbe(commandPath, label, mode, shell) {
  const output = command(commandPath, [PROBE, mode, shell]);
  return {
    id: `${label}:${mode}`,
    command: `${commandPath} ${PROBE} ${mode} ${shell}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(id, image, mode, shell) {
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, shell]);
  return {
    id: `${id}:${mode}`,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${shell}`,
    image,
    result: JSON.parse(output)
  };
}

function compareResults(oracleResult, generatedResult) {
  const oracle = normalizeProbe(oracleResult);
  const generated = normalizeProbe(generatedResult);
  return {
    matches: JSON.stringify(oracle) === JSON.stringify(generated),
    oracle,
    generated
  };
}

const lock = readJson("toolchain.lock.json");
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);
writeGeneratedShell();
writeProbe();

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const runs = [];
const comparisons = [];

const localOracle = runProbe("php", "local-php-cli", "oracle", ORACLE);
const localGenerated = runProbe("php", "local-php-cli", "generated", SHELL);
runs.push(localOracle, localGenerated);
comparisons.push({
  id: "local-php-cli",
  ...compareResults(localOracle.result, localGenerated.result)
});

if (dockerVersion) {
  for (const [id, image] of [
    ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
    ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
  ]) {
    const oracle = runDockerProbe(id, image, "oracle", ORACLE);
    const generated = runDockerProbe(id, image, "generated", SHELL);
    runs.push(oracle, generated);
    comparisons.push({
      id,
      ...compareResults(oracle.result, generated.result)
    });
  }
}

const failures = comparisons.filter((comparison) => !comparison.matches);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.php-facade-f1.v1",
  issue: "WPHX-102",
  generated_at: RECORDED_AT,
  generator: "tools/php-facade/run-f1-global-function.mjs",
  fixture: {
    hxml: HXML,
    haxe_sources: [
      "fixtures/php-facade/src/wphx/fixtures/php/facade/FacadeEntry.hx",
      "fixtures/php-facade/src/wphx/fixtures/php/facade/FacadeKernel.hx"
    ],
    oracle_shell: ORACLE,
    generated_shell: SHELL,
    probe: PROBE
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_version: command("php", ["-r", "echo PHP_VERSION;"]),
    docker_server_version: dockerVersion
  },
  build: {
    command: `haxe ${HXML}`,
    haxe_output_dir: HAXE_OUT,
    generated_file_count: filesUnder(HAXE_OUT).length,
    generated_files: filesUnder(HAXE_OUT),
    shell: {
      path: SHELL,
      sha256: sha256(SHELL)
    },
    probe: {
      path: PROBE,
      sha256: sha256(PROBE)
    }
  },
  runtime_runs: runs,
  comparisons,
  validation_result: {
    status: "passed",
    runtime_run_count: runs.length,
    comparison_count: comparisons.length,
    function_name: "add_filter",
    conditional_availability: true,
    exact_abi_match: true
  }
};

const serialized = JSON.stringify(manifest, null, 2) + "\n";

if (checkOnly) {
  if (!existsSync(OUT)) {
    console.error(JSON.stringify({ status: "failed", error: `${OUT} does not exist` }, null, 2));
    process.exit(1);
  }
  if (readFileSync(OUT, "utf8") !== serialized) {
    console.error(JSON.stringify({ status: "failed", error: `${OUT} is stale` }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: "passed", output: OUT, comparison_count: comparisons.length }, null, 2));
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, serialized);
console.log(JSON.stringify({ status: "passed", output: OUT, comparison_count: comparisons.length }, null, 2));
