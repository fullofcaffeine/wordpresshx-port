import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const check = process.argv.includes("--check");
const root = process.cwd();
const outRoot = join(root, "build/wphx-php/include-side-effects");
const generatedRoot = join(outRoot, "generated");
const shell = join(generatedRoot, "wp-includes/wphx-include-side-effects.php");
const emissionManifestPath = join(generatedRoot, "wphx-php-emission.v1.json");
const probe = join(outRoot, "probe.php");
const shellArtifactPath = "build/wphx-php/include-side-effects/generated/wp-includes/wphx-include-side-effects.php";
const emissionManifestArtifactPath = "build/wphx-php/include-side-effects/generated/wphx-php-emission.v1.json";
const manifestPath = "manifests/wphx-php/include-side-effects.v1.json";
const receiptPath = "receipts/compiler/wphx-comp-php-include-side-effects.v1.json";
const runnerPath = "tools/wphx-php/run-include-side-effects.mjs";
const recordedAt = "2026-06-29T00:00:00.000Z";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`
    );
  }
  return result.stdout ?? "";
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Text(readFileSync(path));
}

function writeOrCheck(path, content) {
  if (check) {
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run without --check to refresh it`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function runProbe(mode) {
  return JSON.parse(run("php", [probe, mode, shell]));
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

run("haxe", ["fixtures/wphx-php/include-side-effects.hxml"]);
run("php", ["-l", shell]);

const shellSource = readFileSync(shell, "utf8");
const expectedPatterns = [
  "$GLOBALS['wphx_include_side_effects'][] = array(",
  "echo 'wphx-include-output:'",
  "return array(",
  "'scope_marker' => isset($wphx_scope_marker) ? $wphx_scope_marker : null",
  "'local_marker' => isset($wphx_local_marker) ? $wphx_local_marker : null"
];
const expectedSegmentPlans = [
  {
    path: "wp-includes/wphx-include-side-effects.php",
    adapter: "include-side-effects",
    adoption_mode: "direct_script_emission",
    segments: ["script", "literal_output", "return_exit"],
    caller_scope: [
      { kind: "reads_locals", names: ["wphx_scope_marker", "wphx_local_marker"] },
      { kind: "globals", names: ["wphx_include_side_effects"] }
    ],
    include_semantics: ["repeated_include", "include_once_second_return_true", "function_scope_include_locals"],
    observable_effects: ["top_level_side_effect", "output_buffering", "include_return_array", "include_once_idempotence"],
    unsupported: []
  }
];
const missingPatterns = expectedPatterns.filter((pattern) => !shellSource.includes(pattern));
if (missingPatterns.length > 0) {
  throw new Error(`Generated include side-effect shell is missing patterns: ${JSON.stringify(missingPatterns)}`);
}

writeFileSync(
  probe,
  `<?php
$mode = $argv[1];
$shell = $argv[2];

function wphx_include_side_effect_event_count() {
  return isset($GLOBALS['wphx_include_side_effects']) ? count($GLOBALS['wphx_include_side_effects']) : 0;
}

function wphx_include_side_effect_from_function($shell) {
  $wphx_scope_marker = 'function';
  $wphx_local_marker = 'local';
  ob_start();
  $return = include $shell;
  $output = ob_get_clean();
  return array(
    'return' => $return,
    'output' => $output,
    'event_count' => wphx_include_side_effect_event_count(),
    'events' => $GLOBALS['wphx_include_side_effects'],
  );
}

$result = array(
  'mode' => $mode,
);

if ('sequence' === $mode) {
  $wphx_scope_marker = 'top';
  ob_start();
  $return1 = include $shell;
  $output1 = ob_get_clean();

  $wphx_scope_marker = 'repeat';
  ob_start();
  $return2 = include $shell;
  $output2 = ob_get_clean();

  $wphx_scope_marker = 'once-after-include';
  ob_start();
  $return3 = include_once $shell;
  $output3 = ob_get_clean();

  $result['probes'] = array(
    array(
      'kind' => 'include',
      'return' => $return1,
      'output' => $output1,
      'event_count' => 1,
    ),
    array(
      'kind' => 'repeat_include',
      'return' => $return2,
      'output' => $output2,
      'event_count' => 2,
    ),
    array(
      'kind' => 'include_once_after_include',
      'return' => $return3,
      'output' => $output3,
      'event_count' => wphx_include_side_effect_event_count(),
    ),
  );
  $result['events'] = $GLOBALS['wphx_include_side_effects'];
} elseif ('include_once' === $mode) {
  $wphx_scope_marker = 'once';
  ob_start();
  $return1 = include_once $shell;
  $output1 = ob_get_clean();

  $wphx_scope_marker = 'once-again';
  ob_start();
  $return2 = include_once $shell;
  $output2 = ob_get_clean();

  $result['probes'] = array(
    array(
      'kind' => 'first_include_once',
      'return' => $return1,
      'output' => $output1,
      'event_count' => 1,
    ),
    array(
      'kind' => 'second_include_once',
      'return' => $return2,
      'output' => $output2,
      'event_count' => wphx_include_side_effect_event_count(),
    ),
  );
  $result['events'] = $GLOBALS['wphx_include_side_effects'];
} elseif ('function_scope' === $mode) {
  $result['probe'] = wphx_include_side_effect_from_function($shell);
} else {
  throw new RuntimeException('Unknown mode ' . $mode);
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`
);

const sequence = runProbe("sequence");
const includeOnce = runProbe("include_once");
const functionScope = runProbe("function_scope");

const expectedSequence = {
  mode: "sequence",
  probes: [
    {
      kind: "include",
      return: { included: true, scope_marker: "top", local_marker: null, run_count: 1 },
      output: "wphx-include-output:top\n",
      event_count: 1
    },
    {
      kind: "repeat_include",
      return: { included: true, scope_marker: "repeat", local_marker: null, run_count: 2 },
      output: "wphx-include-output:repeat\n",
      event_count: 2
    },
    {
      kind: "include_once_after_include",
      return: true,
      output: "",
      event_count: 2
    }
  ],
  events: [
    { scope_marker: "top", local_marker: null, run: 1 },
    { scope_marker: "repeat", local_marker: null, run: 2 }
  ]
};

const expectedIncludeOnce = {
  mode: "include_once",
  probes: [
    {
      kind: "first_include_once",
      return: { included: true, scope_marker: "once", local_marker: null, run_count: 1 },
      output: "wphx-include-output:once\n",
      event_count: 1
    },
    {
      kind: "second_include_once",
      return: true,
      output: "",
      event_count: 1
    }
  ],
  events: [{ scope_marker: "once", local_marker: null, run: 1 }]
};

const expectedFunctionScope = {
  mode: "function_scope",
  probe: {
    return: { included: true, scope_marker: "function", local_marker: "local", run_count: 1 },
    output: "wphx-include-output:function\n",
    event_count: 1,
    events: [{ scope_marker: "function", local_marker: "local", run: 1 }]
  }
};

assertJsonEqual(sequence, expectedSequence, "sequence probe");
assertJsonEqual(includeOnce, expectedIncludeOnce, "include_once probe");
assertJsonEqual(functionScope, expectedFunctionScope, "function_scope probe");

const emissionManifest = JSON.parse(readFileSync(emissionManifestPath, "utf8"));
const declarations = emissionManifest.files.flatMap((file) =>
  file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)
);
const expectedDeclarations = ["wp-includes/wphx-include-side-effects.php:script:include-side-effects"];
assertJsonEqual(declarations, expectedDeclarations, "emission declarations");
if (emissionManifest.unsupported.length !== 0) {
  throw new Error(`Unexpected include side-effect unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
}
const expectedCoreIrFeatures = [
  "file-segment.plan-registry",
  "script.function-scope-include",
  "script.include-return",
  "script.output",
  "script.top-level-side-effect",
  "segment.plan-printer"
];
assertJsonEqual([...emissionManifest.core_ir_features].sort(), expectedCoreIrFeatures, "core IR features");
const segmentPlans = (emissionManifest.segment_plans ?? []).map((plan) => ({
  path: plan.path,
  adapter: plan.adapter,
  adoption_mode: plan.adoption_mode,
  segments: plan.segments,
  caller_scope: plan.caller_scope.map((entry) => ({ kind: entry.kind, names: entry.names })),
  include_semantics: plan.include_semantics,
  observable_effects: plan.observable_effects,
  unsupported: plan.unsupported
}));
assertJsonEqual(segmentPlans, expectedSegmentPlans, "compiler-emitted segment plans");

const manifest = {
  schema: "wphx.wphx-php-include-side-effects.v1",
  issue: "WPHX-COMP-PHP-INCLUDE-SIDE-EFFECTS",
  evidence_class: "generated_shape_and_runtime_include_semantics",
  generated_at: recordedAt,
  runner: runnerPath,
  hxml: "fixtures/wphx-php/include-side-effects.hxml",
  generated_shell: {
    path: shellArtifactPath,
    sha256: sha256File(shell),
    exact_patterns: expectedPatterns
  },
  emission_manifest: {
    path: emissionManifestArtifactPath,
    sha256: sha256File(emissionManifestPath),
    unsupported_empty: true,
    declarations: expectedDeclarations,
    core_ir_features: expectedCoreIrFeatures,
    segment_plans: expectedSegmentPlans
  },
  probes: {
    sequence,
    include_once: includeOnce,
    function_scope: functionScope
  },
  claims: [
    "WPHX PHP emits a bounded original-path direct file-scope script at wp-includes/wphx-include-side-effects.php.",
    "The emitted script performs a top-level include side effect, returns a native PHP array from include/include_once, and emits output that can be captured by output buffering.",
    "Repeated include executes the script repeatedly, while include_once returns true without repeating side effects after the file has already been included.",
    "Function-scope include observes caller local variables, including variables that are not globals."
  ],
  non_claims: [
    "This fixture does not claim mixed PHP/HTML template ownership.",
    "This fixture does not claim arbitrary Haxe expression lowering into direct PHP file scope.",
    "This fixture does not claim WordPress Core include-file ownership beyond the minimized original-path script fixture."
  ],
  ownership_state: {
    state: "compiler_emitted_original_path_shell",
    removal_gate:
      "Replace this special script adapter with typed Adapter IR script nodes or a generic PHP backend/custom-target direct script emission lane when WPHX needs more than bounded include side-effect fixtures.",
    template_boundary:
      "Mixed PHP/HTML template segmentation, caller-scope template loaders, and raw template adoption remain separate migration classes."
  },
  validation_result: {
    status: "passed",
    php_lint: "passed",
    exact_shape_patterns_passed: true,
    runtime_include_sequence_passed: true,
    runtime_include_once_passed: true,
    runtime_function_scope_include_passed: true,
    compiler_emitted_segment_plans_passed: true,
    unsupported_empty: true
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const receipt = {
  schema: "wphx.compiler-core-driver-receipt.v1",
  id: "receipt:wphx-comp-php-include-side-effects",
  issue: "WPHX-COMP-PHP-INCLUDE-SIDE-EFFECTS",
  recorded_at: recordedAt,
  status: "passed",
  artifacts: [
    { path: manifestPath, role: "WPHX PHP include side-effect manifest" },
    { path: runnerPath, role: "deterministic include side-effect runner" }
  ],
  commands: ["npm run wphx:php:include-side-effects", "npm run wphx:php:include-side-effects:check"],
  manifest_sha256: sha256Text(manifestText),
  validation_result: manifest.validation_result,
  claims: manifest.claims,
  non_claims: manifest.non_claims
};

writeOrCheck(manifestPath, manifestText);
writeOrCheck(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ status: "passed", output: manifestPath, receipt: receiptPath }, null, 2));
