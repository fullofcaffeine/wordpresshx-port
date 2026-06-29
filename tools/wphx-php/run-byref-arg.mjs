import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const check = process.argv.includes("--check");
const root = process.cwd();
const outRoot = join(root, "build/wphx-php/byref-arg");
const generatedRoot = join(outRoot, "generated");
const phpFile = join(generatedRoot, "wp-includes/wphx-byref.php");
const manifestFile = join(generatedRoot, "wphx-php-emission.v1.json");
const probeFile = join(outRoot, "probe.php");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`
    );
  }
  return result.stdout ?? "";
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

run("haxe", ["fixtures/wphx-php/byref-arg.hxml"]);
run("php", ["-l", phpFile]);

writeFileSync(
  probeFile,
  `<?php
require ${JSON.stringify(phpFile)};

$function = new ReflectionFunction('wphx_byref_append');
$params = $function->getParameters();
$value = 'seed';
$return = wphx_byref_append($value, '-tail');

echo json_encode(
  array(
    'exists' => function_exists('wphx_byref_append'),
    'name' => $function->getName(),
    'returnsReference' => $function->returnsReference(),
    'params' => array_map(
      function ($param) {
        return array(
          'name' => $param->getName(),
          'position' => $param->getPosition(),
          'isOptional' => $param->isOptional(),
          'hasDefault' => $param->isDefaultValueAvailable(),
          'default' => $param->isDefaultValueAvailable() ? $param->getDefaultValue() : null,
          'isPassedByReference' => $param->isPassedByReference(),
          'isVariadic' => $param->isVariadic(),
        );
      },
      $params
    ),
    'return' => $return,
    'value' => $value,
  ),
  JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`
);

const observed = JSON.parse(run("php", [probeFile]));
const expected = {
  exists: true,
  name: "wphx_byref_append",
  returnsReference: false,
  params: [
    {
      name: "value",
      position: 0,
      isOptional: false,
      hasDefault: false,
      default: null,
      isPassedByReference: true,
      isVariadic: false
    },
    {
      name: "suffix",
      position: 1,
      isOptional: true,
      hasDefault: true,
      default: "-ref",
      isPassedByReference: false,
      isVariadic: false
    }
  ],
  return: "seed-tail",
  value: "seed-tail"
};

if (JSON.stringify(observed) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected WPHX PHP by-reference result:\n${JSON.stringify(observed, null, 2)}`);
}

const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const declarations = manifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`));
if (JSON.stringify(declarations) !== JSON.stringify(["global-function:wphx_byref_append"])) {
  throw new Error(`Unexpected by-reference declarations: ${JSON.stringify(declarations)}`);
}

if (manifest.unsupported.length !== 0) {
  throw new Error(`Unexpected by-reference unsupported constructs: ${JSON.stringify(manifest.unsupported)}`);
}

if (!check) {
  console.log(JSON.stringify({ status: "passed", shell: phpFile, shell_sha256: sha256(phpFile), manifest: manifestFile }, null, 2));
}
