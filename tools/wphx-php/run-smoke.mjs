import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const check = process.argv.includes("--check");
const root = process.cwd();
const outDir = join(root, "build/wphx-php/smoke");
const phpFile = join(outDir, "wp-includes/wphx-smoke.php");
const manifestFile = join(outDir, "wphx-php-emission.v1.json");
const probeFile = join(outDir, "probe.php");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`
    );
  }
  return result.stdout ?? "";
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

run("haxe", ["fixtures/wphx-php/smoke.hxml"]);
run("php", ["-l", phpFile]);

writeFileSync(
  probeFile,
  `<?php
require ${JSON.stringify(phpFile)};
$counter = new WPHX_Smoke_Counter(4);
$result = [
  'add' => wphx_smoke_add(2, 5),
  'greeting' => wphx_smoke_greeting('Core'),
  'label' => WPHX_Smoke_Counter::label(),
  'counter' => $counter->increment(3),
  'counter_default' => $counter->increment(),
  'function_guard' => function_exists('wphx_smoke_add'),
  'class_guard' => class_exists('WPHX_Smoke_Counter', false),
];
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`
);

const observed = JSON.parse(run("php", [probeFile]));
const expected = {
  add: 7,
  greeting: "Hello, Core",
  label: "counter",
  counter: 7,
  counter_default: 8,
  function_guard: true,
  class_guard: true
};

if (JSON.stringify(observed) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected WPHX PHP smoke result:\n${JSON.stringify(observed, null, 2)}`);
}

const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
if (manifest.schema !== "wphx.php-emission.v1" || manifest.files.length !== 1) {
  throw new Error("Unexpected WPHX PHP emission manifest shape");
}

const declarations = manifest.files[0].declarations.map((entry) => `${entry.kind}:${entry.name}`).sort();
const expectedDeclarations = [
  "class:WPHX_Smoke_Counter",
  "global-function:wphx_smoke_add",
  "global-function:wphx_smoke_greeting"
];
if (JSON.stringify(declarations) !== JSON.stringify(expectedDeclarations)) {
  throw new Error(`Unexpected declarations: ${JSON.stringify(declarations)}`);
}

if (!check) {
  console.log("WPHX PHP smoke passed");
}
