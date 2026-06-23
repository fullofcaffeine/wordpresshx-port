#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { filesUnder, sha256File } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const HXML = "fixtures/wp-bootstrap/bootstrap-trace.hxml";
const OUT_ROOT = "build/wp-bootstrap";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-bootstrap/wphx-301-bootstrap-traces.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-301-bootstrap-workset.v1.json";
const RECEIPT = "receipts/wp-bootstrap/wphx-301-bootstrap-traces.v1.json";
const RECORDED_AT = "2026-06-20T20:35:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const SCENARIOS = ["normal", "shortinit", "install", "recovery"];
const SOURCE_UNITS = [
  "src/wp-load.php",
  "src/wp-settings.php",
  "src/wp-includes/load.php",
  "src/wp-includes/default-constants.php"
];

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

function phpVersionFamily(version) {
  return version.split(".").slice(0, 2).join(".");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function sourcePath(unit) {
  return `../wordpress-develop/${unit}`;
}

function sourceRecord(unit) {
  const path = sourcePath(unit);
  return {
    unit,
    repo_path: path,
    bytes: Buffer.byteLength(readFileSync(path)),
    sha256: `sha256:${sha256File(path)}`
  };
}

function lineNumber(text, needle, label) {
  const index = text.split("\n").findIndex((line) => line.includes(needle));
  if (index === -1) {
    throw new Error(`Could not find ${label}: ${needle}`);
  }
  return index + 1;
}

function resolveIncludeExpression(expression) {
  const text = expression.trim();
  const wpincMatch = text.match(/ABSPATH\s*\.\s*WPINC\s*\.\s*'\/([^']+)'/);
  if (wpincMatch) return `wp-includes/${wpincMatch[1]}`;
  const abspathMatch = text.match(/ABSPATH\s*\.\s*'([^']+)'/);
  if (abspathMatch) return abspathMatch[1];
  const contentMatch = text.match(/WP_CONTENT_DIR\s*\.\s*'\/([^']+)'/);
  if (contentMatch) return `wp-content/${contentMatch[1]}`;
  const parentConfigMatch = text.match(/dirname\( ABSPATH \)\s*\.\s*'\/([^']+)'/);
  if (parentConfigMatch) return `../${parentConfigMatch[1]}`;
  const variableMatch = text.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
  if (variableMatch) return `dynamic:$${variableMatch[1]}`;
  return `expression:${text}`;
}

function extractIncludeEvents(unit) {
  const text = readFileSync(sourcePath(unit), "utf8");
  return text
    .split("\n")
    .flatMap((line, index) => {
      const match = line.match(/\b(require_once|require|include_once|include)\s+(.+?);/);
      if (!match) return [];
      return [
        {
          unit,
          line: index + 1,
          kind: match[1],
          target: resolveIncludeExpression(match[2])
        }
      ];
    });
}

function summarizeEvents(id, events) {
  const stableEvents = events.map((event) => ({
    line: event.line,
    kind: event.kind,
    target: event.target
  }));
  return {
    id,
    count: stableEvents.length,
    first: stableEvents[0] ?? null,
    last: stableEvents[stableEvents.length - 1] ?? null,
    sha256: sha256(JSON.stringify(stableEvents))
  };
}

function buildOracle() {
  const settingsText = readFileSync(sourcePath("src/wp-settings.php"), "utf8");
  const loadText = readFileSync(sourcePath("src/wp-includes/load.php"), "utf8");
  const constantsText = readFileSync(sourcePath("src/wp-includes/default-constants.php"), "utf8");
  const wpLoadText = readFileSync(sourcePath("src/wp-load.php"), "utf8");

  const shortinitLine = lineNumber(settingsText, "if ( SHORTINIT )", "SHORTINIT gate");
  const recoveryLine = lineNumber(settingsText, "wp_recovery_mode()->initialize();", "recovery mode initialization");
  const installingLine = lineNumber(loadText, "defined( 'WP_INSTALLING' ) && WP_INSTALLING", "WP_INSTALLING default");
  const shortinitDefaultLine = lineNumber(constantsText, "define( 'SHORTINIT', false );", "SHORTINIT default");
  const wpLoadConfigLine = lineNumber(wpLoadText, "file_exists( ABSPATH . 'wp-config.php' )", "wp-config root discovery");
  const wpLoadSetupLine = lineNumber(wpLoadText, "setup-config.php", "setup-config fallback");
  const settingsEvents = extractIncludeEvents("src/wp-settings.php");
  const wpLoadEvents = extractIncludeEvents("src/wp-load.php");
  const preShortinit = settingsEvents.filter((event) => event.line < shortinitLine);
  const postShortinit = settingsEvents.filter((event) => event.line > shortinitLine);
  const recoveryWindow = settingsEvents.filter((event) => event.line > shortinitLine && event.line < recoveryLine);

  const source_units = SOURCE_UNITS.map(sourceRecord);
  return {
    source_units,
    upstream_digest: sha256(JSON.stringify(source_units.map((unit) => ({ unit: unit.unit, sha256: unit.sha256 })))),
    markers: {
      wp_load_config_discovery_line: wpLoadConfigLine,
      wp_load_setup_config_line: wpLoadSetupLine,
      shortinit_gate_line: shortinitLine,
      recovery_initialize_line: recoveryLine,
      wp_installing_constant_line: installingLine,
      shortinit_default_line: shortinitDefaultLine
    },
    phases: {
      "wp-load:config-discovery": summarizeEvents("wp-load:config-discovery", wpLoadEvents),
      "wp-settings:pre-shortinit": summarizeEvents("wp-settings:pre-shortinit", preShortinit),
      "wp-settings:post-shortinit": summarizeEvents("wp-settings:post-shortinit", postShortinit),
      "wp-settings:recovery-window": summarizeEvents("wp-settings:recovery-window", recoveryWindow),
      "wp-settings:full": summarizeEvents("wp-settings:full", settingsEvents)
    }
  };
}

function scenarioOracle(scenario, oracle) {
  const shortinit = scenario === "shortinit";
  const installing = scenario === "install";
  const recovery = scenario === "recovery";
  return {
    scenario,
    shortinit,
    installing,
    recovery,
    terminal: shortinit ? "shortinit_return" : "full_bootstrap",
    expected_gates: [
      { id: "wp-load:config-discovery", active: true, source: "src/wp-load.php", line: oracle.markers.wp_load_config_discovery_line },
      { id: "wp-settings:wpinc-defined", active: true, source: "src/wp-settings.php", line: 16 },
      { id: "wp-settings:shortinit", active: shortinit, source: "src/wp-settings.php", line: oracle.markers.shortinit_gate_line },
      { id: "wp-includes/load:wp_installing", active: installing, source: "src/wp-includes/load.php", line: oracle.markers.wp_installing_constant_line },
      { id: "wp-settings:recovery-mode", active: recovery, source: "src/wp-settings.php", line: oracle.markers.recovery_initialize_line }
    ],
    expected_phases: [
      { id: "wp-settings:pre-shortinit", active: true, digest: oracle.phases["wp-settings:pre-shortinit"].sha256 },
      { id: "wp-settings:post-shortinit", active: !shortinit, digest: oracle.phases["wp-settings:post-shortinit"].sha256 },
      { id: "wp-settings:recovery-window", active: !shortinit && recovery, digest: oracle.phases["wp-settings:recovery-window"].sha256 },
      { id: "wp-load:setup-config", active: false, digest: oracle.phases["wp-load:config-discovery"].sha256 }
    ]
  };
}

function writeProbe() {
  writeFile(
    PROBE,
    `<?php

$scenario = $argv[1] ?? 'normal';
$wphx_301_lib = __DIR__ . '/haxe/lib';
set_include_path( get_include_path() . PATH_SEPARATOR . $wphx_301_lib );
spl_autoload_register(
\tfunction ( $class ) {
\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\tif ( $file ) {
\t\t\tinclude_once $file;
\t\t}
\t}
);
\\php\\Boot::__hx__init();
echo \\wphx\\fixtures\\wp\\bootstrap\\BootstrapKernel::traceJson( $scenario );
`
  );
}

function runProbe(commandPath, label, scenario) {
  const output = command(commandPath, [PROBE, scenario]);
  return {
    id: `${label}:${scenario}`,
    runtime: label,
    scenario,
    command: `${commandPath} ${PROBE} ${scenario}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(id, image, scenario) {
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, scenario]);
  return {
    id: `${id}:${scenario}`,
    runtime: id,
    scenario,
    image,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${scenario}`,
    result: JSON.parse(output)
  };
}

function byId(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function validateRun(run, expected) {
  const errors = [];
  if (run.result.scenario !== expected.scenario) errors.push(`${run.id}: expected scenario ${expected.scenario}, got ${run.result.scenario}`);
  if (run.result.shortinit !== expected.shortinit) errors.push(`${run.id}: shortinit mismatch`);
  if (run.result.installing !== expected.installing) errors.push(`${run.id}: installing mismatch`);
  if (run.result.recovery !== expected.recovery) errors.push(`${run.id}: recovery mismatch`);
  if (run.result.terminal !== expected.terminal) errors.push(`${run.id}: terminal mismatch`);

  const gates = byId(run.result.gates ?? []);
  for (const expectedGate of expected.expected_gates) {
    const actual = gates.get(expectedGate.id);
    if (!actual) {
      errors.push(`${run.id}: missing gate ${expectedGate.id}`);
    } else if (actual.active !== expectedGate.active) {
      errors.push(`${run.id}: gate ${expectedGate.id} active mismatch`);
    }
  }

  const phases = byId(run.result.phases ?? []);
  for (const expectedPhase of expected.expected_phases) {
    const actual = phases.get(expectedPhase.id);
    if (!actual) {
      errors.push(`${run.id}: missing phase ${expectedPhase.id}`);
    } else if (actual.active !== expectedPhase.active) {
      errors.push(`${run.id}: phase ${expectedPhase.id} active mismatch`);
    }
  }
  return errors;
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp/bootstrap-workset",
    issue: {
      id: "wordpresshx-l76.1",
      external_ref: "WPHX-301"
    },
    unit: {
      kind: "workset",
      name: "bootstrap/load-order/constants/environment",
      area: "bootstrap",
      public_contract: "normal, SHORTINIT, install, and recovery bootstrap traces"
    },
    ownership_state: "scaffolded_haxe",
    upstream: {
      repo: "../wordpress-develop",
      ref: WP_REF,
      paths: SOURCE_UNITS,
      digest: upstreamDigest
    },
    owned_paths: [
      "fixtures/wp-bootstrap/src/wphx/fixtures/wp/bootstrap/BootstrapEntry.hx",
      "fixtures/wp-bootstrap/src/wphx/fixtures/wp/bootstrap/BootstrapKernel.hx",
      "fixtures/wp-bootstrap/bootstrap-trace.hxml",
      "tools/wp-bootstrap/run-bootstrap-traces.mjs"
    ],
    generated_paths: [
      "build/wp-bootstrap/haxe",
      "build/wp-bootstrap/probe.php"
    ],
    verification: {
      oracle_commands: [
        "npm run wp:bootstrap:trace",
        "npm run wp:bootstrap:trace:check"
      ],
      receipt_refs: [
        "receipt:wphx-301-bootstrap-traces"
      ],
      manifest_digest: manifestSha
    },
    notes: "This is the first bootstrap workset scaffold. It records gate and load-order evidence before claiming individual source units as Haxe parity candidates."
  };
}

const lock = readJson("toolchain.lock.json");
const oracle = buildOracle();

rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);
writeProbe();

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const runs = [];
for (const scenario of SCENARIOS) {
  runs.push(runProbe("php", "local-php-cli", scenario));
}
if (dockerVersion) {
  for (const [id, image] of [
    ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
    ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
  ]) {
    for (const scenario of SCENARIOS) {
      runs.push(runDockerProbe(id, image, scenario));
    }
  }
}

const scenarioExpectations = Object.fromEntries(SCENARIOS.map((scenario) => [scenario, scenarioOracle(scenario, oracle)]));
const errors = runs.flatMap((run) => validateRun(run, scenarioExpectations[run.scenario]));
if (errors.length > 0) {
  console.error(JSON.stringify({ status: "failed", errors, runs }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-bootstrap-traces.v1",
  issue: "WPHX-301",
  generated_at: RECORDED_AT,
  generator: "tools/wp-bootstrap/run-bootstrap-traces.mjs",
  fixture: {
    hxml: HXML,
    haxe_sources: [
      "fixtures/wp-bootstrap/src/wphx/fixtures/wp/bootstrap/BootstrapEntry.hx",
      "fixtures/wp-bootstrap/src/wphx/fixtures/wp/bootstrap/BootstrapKernel.hx"
    ],
    generated_root: HAXE_OUT,
    probe: PROBE
  },
  oracle,
  scenarios: SCENARIOS.map((scenario) => scenarioExpectations[scenario]),
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_version_family: phpVersionFamily(command("php", ["-r", "echo PHP_VERSION;"])),
    docker_available: dockerVersion != null
  },
  build: {
    command: `haxe ${HXML}`,
    haxe_output_dir: HAXE_OUT,
    generated_haxe_file_count: filesUnder(HAXE_OUT).length,
    generated_haxe_files: filesUnder(HAXE_OUT),
    probe: {
      path: PROBE,
      sha256: `sha256:${sha256File(PROBE)}`
    }
  },
  runtime_runs: runs,
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    scenario_count: SCENARIOS.length,
    runtime_run_count: runs.length,
    oracle_phase_digests_recorded: true,
    haxe_gate_trace_matches_oracle: true,
    scaffolded_haxe_ownership_recorded: true
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, oracle.upstream_digest), null, 2) + "\n";
const receipt = {
  schema: "wphx.wp-bootstrap-traces-receipt.v1",
  id: "receipt:wphx-301-bootstrap-traces",
  issue: "WPHX-301",
  recorded_at: RECORDED_AT,
  command: "npm run wp:bootstrap:trace",
  status: "passed",
  manifest: OUT,
  manifest_sha256: manifestSha,
  ownership_manifest: OWNERSHIP,
  ownership_manifest_sha256: sha256(ownershipText),
  scenario_count: SCENARIOS.length,
  runtime_run_count: runs.length,
  upstream_digest: oracle.upstream_digest
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (checkOnly) {
  for (const [path, text] of [
    [OUT, manifestText],
    [OWNERSHIP, ownershipText],
    [RECEIPT, receiptText]
  ]) {
    if (!existsSync(path)) {
      console.error(JSON.stringify({ status: "failed", error: `${path} does not exist` }, null, 2));
      process.exit(1);
    }
    if (readFileSync(path, "utf8") !== text) {
      console.error(JSON.stringify({ status: "failed", error: `${path} is stale` }, null, 2));
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, scenarios: SCENARIOS.length, runtime_run_count: runs.length }, null, 2));
  process.exit(0);
}

writeFile(OUT, manifestText);
writeFile(OWNERSHIP, ownershipText);
writeFile(RECEIPT, receiptText);
console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, scenarios: SCENARIOS.length, runtime_run_count: runs.length }, null, 2));
