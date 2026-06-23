#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { filesUnder as stableFilesUnder } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const HXML = "fixtures/php-facade/f6-template-scope.hxml";
const OUT_ROOT = "build/php-template-scope";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const PROBE = `${OUT_ROOT}/probe.php`;
const ORACLE_ROOT = "fixtures/php-facade/oracle/template-scope";
const OUT = "manifests/php-facade/wphx-107-f6-template-scope.v1.json";
const RECORDED_AT = "2026-06-20T07:08:00Z";
const SCENARIOS = ["admin-style", "theme-style"];

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
  return stableFilesUnder(dir);
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function bootstrapBlock() {
  return `if ( ! function_exists( 'wphx_f6_bootstrap_haxe' ) ) {
\tfunction wphx_f6_bootstrap_haxe() {
\t\tif ( defined( 'WPHX_F6_TEMPLATE_BOOTSTRAPPED' ) ) {
\t\t\treturn;
\t\t}

\t\tdefine( 'WPHX_F6_TEMPLATE_BOOTSTRAPPED', true );
\t\t$wphx_f6_lib = dirname( __DIR__, 3 ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_f6_lib );
\t\tspl_autoload_register(
\t\t\tfunction ( $class ) {
\t\t\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\t\t\tif ( $file ) {
\t\t\t\t\tinclude_once $file;
\t\t\t\t}
\t\t\t}
\t\t);
\t\t\\php\\Boot::__hx__init();
\t}
}

wphx_f6_bootstrap_haxe();
`;
}

function writeGeneratedTree() {
  writeFile(
    `${GENERATED_ROOT}/wp-admin/admin-fixture.php`,
    `<?php

if ( ! defined( 'ABSPATH' ) ) {
\treturn 'ABSPATH_REQUIRED';
}

${bootstrapBlock().replace("dirname( __DIR__, 3 )", "dirname( __DIR__, 2 )")}
if ( ! function_exists( 'wphx_f6_generated_escape' ) ) {
\tfunction wphx_f6_generated_escape( $value ) {
\t\treturn htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
\t}
}

$GLOBALS['wphx_f6_trace'][] = array(
\t'event' => 'admin:begin',
\t'title' => $title,
\t'itemCount' => count( $items ),
);

$notice = \\wphx\\fixtures\\php\\facade\\TemplateKernel::notice( $notice );
$screen->rendered = true;
?>
<div class="wrap" data-screen="<?php echo wphx_f6_generated_escape( $screen->id ); ?>">
\t<h1><?php echo wphx_f6_generated_escape( $title ); ?></h1>
\t<div class="notice"><?php echo wphx_f6_generated_escape( $notice ); ?></div>
\t<ul class="wp-list-table">
\t\t<?php foreach ( $items as $index => $item ) : ?>
\t\t\t<li class="<?php echo wphx_f6_generated_escape( \\wphx\\fixtures\\php\\facade\\TemplateKernel::rowClass( $index ) ); ?>" data-index="<?php echo wphx_f6_generated_escape( $index ); ?>"><?php echo wphx_f6_generated_escape( $item ); ?></li>
\t\t<?php endforeach; ?>
\t</ul>
</div>
<?php
$items[] = 'admin-mutated';
$GLOBALS['wphx_f6_trace'][] = array(
\t'event' => 'admin:end',
\t'notice' => $notice,
\t'itemCount' => count( $items ),
);

return array(
\t'kind' => 'admin',
\t'notice' => $notice,
\t'itemCount' => count( $items ),
\t'marker' => \\wphx\\fixtures\\php\\facade\\TemplateKernel::marker( 'admin' ),
);
`
  );

  writeFile(
    `${GENERATED_ROOT}/wp-content/themes/wphx-fixture/content.php`,
    `<?php

if ( ! defined( 'ABSPATH' ) ) {
\treturn 'ABSPATH_REQUIRED';
}

${bootstrapBlock().replace("dirname( __DIR__, 3 )", "dirname( __DIR__, 4 )")}
if ( ! function_exists( 'wphx_f6_generated_escape' ) ) {
\tfunction wphx_f6_generated_escape( $value ) {
\t\treturn htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
\t}
}

$GLOBALS['wphx_f6_trace'][] = array(
\t'event' => 'theme:begin',
\t'postId' => $post['ID'],
);

$classes[] = 'rendered';
$post['rendered'] = true;
$GLOBALS['wp_query']['seen'][] = $post['ID'];
?>
<article id="post-<?php echo wphx_f6_generated_escape( $post['ID'] ); ?>" class="<?php echo wphx_f6_generated_escape( implode( ' ', $classes ) ); ?>">
\t<h2><?php echo wphx_f6_generated_escape( $post['title'] ); ?></h2>
\t<?php $meta_return = include __DIR__ . '/template-parts/meta.php'; ?>
\t<p class="entry-meta"><?php echo wphx_f6_generated_escape( $meta_line ); ?></p>
\t<div class="entry-summary"><?php echo wphx_f6_generated_escape( \\wphx\\fixtures\\php\\facade\\TemplateKernel::excerpt( $post['content'], 24 ) ); ?></div>
</article>
<?php
$GLOBALS['wphx_f6_trace'][] = array(
\t'event' => 'theme:end',
\t'postId' => $post['ID'],
\t'classes' => $classes,
);

return array(
\t'kind' => 'theme',
\t'metaReturn' => $meta_return,
\t'classCount' => count( $classes ),
\t'postRendered' => $post['rendered'],
);
`
  );

  writeFile(
    `${GENERATED_ROOT}/wp-content/themes/wphx-fixture/template-parts/meta.php`,
    `<?php

$meta_line = \\wphx\\fixtures\\php\\facade\\TemplateKernel::metaLine( $post['author'], $post['date'] );
$GLOBALS['wphx_f6_trace'][] = array(
\t'event' => 'theme:meta',
\t'postId' => $post['ID'],
\t'meta' => $meta_line,
);

return 'meta:' . $post['ID'];
`
  );
}

function writeProbe() {
  writeFile(
    PROBE,
    `<?php

$mode = $argv[1];
$scenario = $argv[2];
$root = rtrim( $argv[3], '/' );

function wphx_f6_normalize_output( $output ) {
\t$output = str_replace( array( "\\r\\n", "\\r" ), "\\n", $output );
\treturn trim( $output );
}

function wphx_f6_admin_case( $root ) {
\tif ( ! defined( 'ABSPATH' ) ) {
\t\tdefine( 'ABSPATH', $root . '/' );
\t}

\t$GLOBALS['wphx_f6_trace'] = array();
\t$title = 'Posts & Pages';
\t$notice = 'saved';
\t$items = array( 'alpha', 'beta <two>' );
\t$screen = (object) array( 'id' => 'edit-post' );

\tob_start();
\t$return = include $root . '/wp-admin/admin-fixture.php';
\t$output = ob_get_clean();

\treturn array(
\t\t'returnValue' => $return,
\t\t'output' => wphx_f6_normalize_output( $output ),
\t\t'locals' => array(
\t\t\t'title' => $title,
\t\t\t'notice' => $notice,
\t\t\t'items' => $items,
\t\t\t'screen' => array(
\t\t\t\t'id' => $screen->id,
\t\t\t\t'rendered' => $screen->rendered ?? false,
\t\t\t),
\t\t),
\t\t'trace' => $GLOBALS['wphx_f6_trace'],
\t);
}

function wphx_f6_theme_case( $root ) {
\tif ( ! defined( 'ABSPATH' ) ) {
\t\tdefine( 'ABSPATH', $root . '/' );
\t}

\t$GLOBALS['wphx_f6_trace'] = array();
\t$GLOBALS['wp_query'] = array( 'seen' => array() );
\t$post = array(
\t\t'ID' => 42,
\t\t'title' => 'Hello <World>',
\t\t'author' => 'Ada',
\t\t'date' => '2026-06-20',
\t\t'content' => 'This is the content body for a theme template fixture.',
\t);
\t$classes = array( 'post', 'type-post' );

\tob_start();
\t$return = include $root . '/wp-content/themes/wphx-fixture/content.php';
\t$output = ob_get_clean();

\treturn array(
\t\t'returnValue' => $return,
\t\t'output' => wphx_f6_normalize_output( $output ),
\t\t'locals' => array(
\t\t\t'post' => $post,
\t\t\t'classes' => $classes,
\t\t\t'metaLine' => $meta_line ?? null,
\t\t),
\t\t'globals' => array(
\t\t\t'wpQuery' => $GLOBALS['wp_query'],
\t\t),
\t\t'trace' => $GLOBALS['wphx_f6_trace'],
\t);
}

if ( 'admin-style' === $scenario ) {
\t$result = wphx_f6_admin_case( $root );
} elseif ( 'theme-style' === $scenario ) {
\t$result = wphx_f6_theme_case( $root );
} else {
\tfwrite( STDERR, 'Unknown scenario: ' . $scenario . PHP_EOL );
\texit( 2 );
}

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'scenario' => $scenario,
\t\t'result' => $result,
\t),
\tJSON_UNESCAPED_SLASHES
);
`
  );
}

function normalizeProbe(result) {
  return {
    scenario: result.scenario,
    result: result.result
  };
}

function runProbe(commandPath, label, mode, scenario, root) {
  const output = command(commandPath, [PROBE, mode, scenario, root]);
  return {
    id: `${label}:${mode}:${scenario}`,
    command: `${commandPath} ${PROBE} ${mode} ${scenario} ${root}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(id, image, mode, scenario, root) {
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, scenario, root]);
  return {
    id: `${id}:${mode}:${scenario}`,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${scenario} ${root}`,
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
writeGeneratedTree();
writeProbe();

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const runs = [];
const comparisons = [];

for (const scenario of SCENARIOS) {
  const oracle = runProbe("php", "local-php-cli", "oracle", scenario, ORACLE_ROOT);
  const generated = runProbe("php", "local-php-cli", "generated", scenario, GENERATED_ROOT);
  runs.push(oracle, generated);
  comparisons.push({
    id: `local-php-cli:${scenario}`,
    ...compareResults(oracle.result, generated.result)
  });
}

if (dockerVersion) {
  for (const [id, image] of [
    ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
    ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
  ]) {
    for (const scenario of SCENARIOS) {
      const oracle = runDockerProbe(id, image, "oracle", scenario, ORACLE_ROOT);
      const generated = runDockerProbe(id, image, "generated", scenario, GENERATED_ROOT);
      runs.push(oracle, generated);
      comparisons.push({
        id: `${id}:${scenario}`,
        ...compareResults(oracle.result, generated.result)
      });
    }
  }
}

const failures = comparisons.filter((comparison) => !comparison.matches);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.php-facade-f6-template-scope.v1",
  issue: "WPHX-107",
  generated_at: RECORDED_AT,
  generator: "tools/php-facade/run-f6-template-scope.mjs",
  fixture: {
    hxml: HXML,
    haxe_sources: [
      "fixtures/php-facade/src/wphx/fixtures/php/facade/TemplateEntry.hx",
      "fixtures/php-facade/src/wphx/fixtures/php/facade/TemplateKernel.hx"
    ],
    oracle_root: ORACLE_ROOT,
    generated_root: GENERATED_ROOT,
    probe: PROBE,
    scenarios: SCENARIOS
  },
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
    generated_shell_file_count: filesUnder(GENERATED_ROOT).length,
    generated_shell_files: filesUnder(GENERATED_ROOT),
    oracle_files: filesUnder(ORACLE_ROOT),
    probe: {
      path: PROBE,
      sha256: sha256(PROBE)
    }
  },
  runtime_runs: runs,
  comparisons,
  template_strategy: {
    php_shell_owns_mixed_template_output_order: true,
    php_shell_owns_caller_scope_mutation: true,
    php_shell_owns_nested_template_include: true,
    haxe_owns_bounded_template_helpers: true,
    boundary_note: "Existing mixed PHP/HTML templates remain original-path PHP shells until caller scope, globals, includes, output, and return values are explicitly bounded. Haxe can own helper payloads behind that shell boundary."
  },
  validation_result: {
    status: "passed",
    runtime_run_count: runs.length,
    comparison_count: comparisons.length,
    admin_style_template: true,
    theme_style_template: true,
    mixed_output_order: true,
    caller_local_mutation: true,
    object_local_mutation: true,
    global_state_mutation: true,
    nested_partial_include: true,
    include_return_values: true
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
