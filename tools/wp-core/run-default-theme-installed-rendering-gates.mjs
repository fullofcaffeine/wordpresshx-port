#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-c6te",
  external_ref: "WPHX-320.06",
  title: "WPHX-320.06 - Declare default theme installed rendering gates"
};
const RECORDED_AT = "2026-07-07T21:00:00.000Z";
const RUNNER = "tools/wp-core/run-default-theme-installed-rendering-gates.mjs";
const UPSTREAM_ROOT = "../wordpress-develop";
const OUT = "manifests/wp-core/wphx-320-06-default-theme-installed-rendering-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-06-default-theme-installed-rendering-gates.v1.json";

const EVIDENCE_DEPENDENCIES = [
  {
    id: "wphx-320-01-surface",
    path: "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json",
    role: "default-theme PHP source, distribution, ABI, test, HXX-candidate, and handoff surface inventory"
  },
  {
    id: "wphx-320-02-hxx-pilot",
    path: "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json",
    role: "bounded typed HXX-style hero/navigation markup-unit pilot with WPHX PHP segment-shell evidence"
  },
  {
    id: "wphx-320-03-upstream-browser-ratchets",
    path: "manifests/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json",
    role: "selected upstream theme/template PHPUnit ratchets and blocked browser/performance/visual references"
  },
  {
    id: "wphx-320-04-pattern-fixture",
    path: "manifests/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json",
    role: "selected copied-oracle bundled default-theme pattern PHP output observations"
  },
  {
    id: "wphx-320-05-functions-fixture",
    path: "manifests/wp-core/wphx-320-05-default-theme-functions-oracle-fixture.v1.json",
    role: "selected copied-oracle bundled default-theme functions.php hook/callback observations"
  },
  {
    id: "wphx-310-10-installed-theme-precedent",
    path: "manifests/wp-core/wphx-310-10-theme-installed-distribution.v1.json",
    role: "theme-system installed-style package/root precedent; not WPHX-320 default-theme rendering parity"
  },
  {
    id: "upstream-lock",
    path: "upstream.lock.json",
    role: "WordPress 7.0 oracle checkout path and revision authority"
  }
];

const UPSTREAM_SOURCE_FILES = [
  "src/index.php",
  "src/wp-blog-header.php",
  "src/wp-load.php",
  "src/wp-includes/template-loader.php",
  "src/wp-includes/template-canvas.php",
  "src/wp-includes/template.php",
  "src/wp-includes/theme.php",
  "src/wp-includes/class-wp-theme.php",
  "src/wp-includes/block-template.php",
  "src/wp-includes/block-template-utils.php",
  "src/wp-includes/block-patterns.php",
  "src/wp-includes/class-wp-block-template.php",
  "src/wp-includes/class-wp-block-patterns-registry.php",
  "src/wp-includes/class-wp-block-pattern-categories-registry.php",
  "src/wp-includes/class-wp-block-bindings-registry.php",
  "src/wp-includes/class-wp-block-bindings-source.php",
  "src/wp-includes/class-wp-theme-json.php",
  "src/wp-includes/class-wp-theme-json-resolver.php",
  "src/wp-includes/global-styles-and-settings.php",
  "src/wp-includes/style-engine.php",
  "src/wp-content/themes/twentytwentyfive/functions.php",
  "src/wp-content/themes/twentytwentyfive/theme.json",
  "src/wp-content/themes/twentytwentyfive/templates/home.html",
  "src/wp-content/themes/twentytwentyfive/templates/single.html",
  "src/wp-content/themes/twentytwentyfive/templates/page.html",
  "src/wp-content/themes/twentytwentyfive/templates/search.html",
  "src/wp-content/themes/twentytwentyfive/templates/archive.html",
  "src/wp-content/themes/twentytwentyfive/templates/404.html",
  "src/wp-content/themes/twentytwentyfive/parts/header.html",
  "src/wp-content/themes/twentytwentyfive/parts/footer.html",
  "src/wp-content/themes/twentytwentyfive/patterns/hero-full-width-image.php",
  "src/wp-content/themes/twentytwentyfive/patterns/footer.php",
  "src/wp-content/themes/twentytwentyfive/patterns/template-home-text-blog.php",
  "src/wp-content/themes/twentytwentyfive/patterns/template-single-text-blog.php",
  "src/wp-content/themes/twentytwentyfive/patterns/template-404-vertical-header-blog.php",
  "src/wp-content/themes/twentytwentyfour/functions.php",
  "src/wp-content/themes/twentytwentyfour/theme.json",
  "src/wp-content/themes/twentytwentyfour/templates/home.html",
  "src/wp-content/themes/twentytwentyfour/templates/single.html",
  "src/wp-content/themes/twentytwentyfour/templates/page.html",
  "src/wp-content/themes/twentytwentyfour/templates/search.html",
  "src/wp-content/themes/twentytwentyfour/templates/archive.html",
  "src/wp-content/themes/twentytwentyfour/templates/404.html",
  "src/wp-content/themes/twentytwentyfour/parts/header.html",
  "src/wp-content/themes/twentytwentyfour/parts/footer.html",
  "src/wp-content/themes/twentytwentyfour/patterns/footer.php",
  "src/wp-content/themes/twentytwentyfour/patterns/hidden-search.php",
  "src/wp-content/themes/twentytwentythree/theme.json",
  "src/wp-content/themes/twentytwentythree/templates/home.html",
  "src/wp-content/themes/twentytwentythree/templates/single.html",
  "src/wp-content/themes/twentytwentythree/templates/page.html",
  "src/wp-content/themes/twentytwentythree/templates/search.html",
  "src/wp-content/themes/twentytwentythree/templates/archive.html",
  "src/wp-content/themes/twentytwentythree/templates/404.html",
  "src/wp-content/themes/twentytwentythree/parts/header.html",
  "src/wp-content/themes/twentytwentythree/parts/footer.html",
  "src/wp-content/themes/twentytwentythree/patterns/call-to-action.php",
  "src/wp-content/themes/twentytwentytwo/functions.php",
  "src/wp-content/themes/twentytwentytwo/inc/block-patterns.php",
  "src/wp-content/themes/twentytwentytwo/theme.json",
  "src/wp-content/themes/twentytwentytwo/templates/home.html",
  "src/wp-content/themes/twentytwentytwo/templates/single.html",
  "src/wp-content/themes/twentytwentytwo/templates/page.html",
  "src/wp-content/themes/twentytwentytwo/templates/search.html",
  "src/wp-content/themes/twentytwentytwo/templates/archive.html",
  "src/wp-content/themes/twentytwentytwo/templates/404.html"
];

const UPSTREAM_TEST_FILES = [
  "tests/performance/specs/home.test.js",
  "tests/performance/specs/single-post.test.js",
  "tests/performance/specs/admin.test.js",
  "tests/performance/utils.js",
  "tests/performance/log-results.js",
  "tests/performance/wp-content/mu-plugins/server-timing.php",
  "tests/visual-regression/specs/visual-snapshots.test.js",
  "tests/visual-regression/playwright.config.js",
  "tests/phpunit/tests/template.php",
  "tests/phpunit/tests/theme.php",
  "tests/phpunit/tests/theme/support.php",
  "tests/phpunit/tests/theme/wpTheme.php",
  "tests/phpunit/tests/theme/wpThemeJson.php",
  "tests/phpunit/tests/theme/wpThemeJsonResolver.php",
  "tests/phpunit/tests/theme/wpThemeGetBlockPatterns.php",
  "tests/phpunit/tests/theme/wpGetGlobalStylesheet.php",
  "tests/phpunit/tests/block-template.php",
  "tests/phpunit/tests/block-template-utils.php",
  "tests/phpunit/tests/block-templates/buildBlockTemplateResultFromFile.php",
  "tests/phpunit/tests/block-templates/getTemplateHierarchy.php",
  "tests/phpunit/tests/link/themeFile.php",
  "tests/phpunit/tests/option/themeMods.php"
];

const SELECTED_INSTALLED_GATES = [
  {
    id: "default-theme-home-route-rendering",
    kind: "installed_http_browser_performance",
    route_family: "front_home",
    representative_routes: ["/"],
    default_theme_scope: ["twentytwentyfive", "twentytwentyfour", "twentytwentythree", "twentytwentytwo"],
    upstream_refs: [
      "src/index.php",
      "src/wp-blog-header.php",
      "src/wp-includes/template-loader.php",
      "src/wp-includes/template-canvas.php",
      "src/wp-includes/block-template.php",
      "tests/performance/specs/home.test.js"
    ],
    scope:
      "home/front-page HTTP rendering through real WordPress bootstrap, template-loader, block template resolution, query loop, global styles, theme assets, and browser/performance observation",
    existing_evidence_refs: ["WPHX-320.01", "WPHX-320.02", "WPHX-320.03", "WPHX-320.04", "WPHX-320.05"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-309", "WPHX-310", "WPHX-314", "WPHX-400"],
    blockers: [
      "No real installed oracle/candidate roots with identical database, posts, options, rewrite, theme, and cache state are provisioned for default-theme rendering.",
      "No generated candidate overlay manifest exists for bundled default-theme files, template-loader paths, or block-template rendering paths.",
      "No browser/performance runner compares rendered DOM, HTTP headers, asset requests, PHP logs, and timings across oracle and candidate packages."
    ]
  },
  {
    id: "default-theme-single-post-route-rendering",
    kind: "installed_http_browser_performance",
    route_family: "front_single_post",
    representative_routes: ["/2018/11/03/block-image/", "/fixture-post/"],
    default_theme_scope: ["twentytwentyfive", "twentytwentyfour", "twentytwentythree", "twentytwentytwo"],
    upstream_refs: [
      "src/wp-includes/template-loader.php",
      "src/wp-includes/block-template.php",
      "src/wp-content/themes/twentytwentyfive/templates/single.html",
      "src/wp-content/themes/twentytwentyfour/templates/single.html",
      "src/wp-content/themes/twentytwentythree/templates/single.html",
      "src/wp-content/themes/twentytwentytwo/templates/single.html",
      "tests/performance/specs/single-post.test.js"
    ],
    scope:
      "single-post HTTP/browser rendering through loop globals, post content, featured/media assets, comments/template parts, post format binding, canonical links, and block rendering",
    existing_evidence_refs: ["WPHX-320.01", "WPHX-320.03", "WPHX-320.05"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-308", "WPHX-312", "WPHX-313", "WPHX-314"],
    blockers: [
      "No seeded post/query/comment/media database corpus exists for oracle/candidate default-theme single-post comparison.",
      "No generated candidate overlay manifest exists for default-theme single templates, parts, functions.php, or block-binding paths.",
      "No installed HTTP/browser diff records canonical URL, DOM fragments, comments, media requests, PHP logs, database reads, and browser timing parity."
    ]
  },
  {
    id: "default-theme-page-search-archive-404-hierarchy",
    kind: "installed_http_template_hierarchy",
    route_family: "front_template_hierarchy",
    representative_routes: ["/sample-page/", "/?s=search", "/category/news/", "/does-not-exist/"],
    default_theme_scope: ["twentytwentyfive", "twentytwentyfour", "twentytwentythree", "twentytwentytwo"],
    upstream_refs: [
      "src/wp-includes/template-loader.php",
      "src/wp-includes/block-template-utils.php",
      "src/wp-content/themes/twentytwentyfive/templates/page.html",
      "src/wp-content/themes/twentytwentyfive/templates/search.html",
      "src/wp-content/themes/twentytwentyfive/templates/archive.html",
      "src/wp-content/themes/twentytwentyfive/templates/404.html",
      "tests/phpunit/tests/template.php",
      "tests/phpunit/tests/block-templates/getTemplateHierarchy.php"
    ],
    scope:
      "page/search/archive/404 template hierarchy, block-template fallback, include timing, query context, title/body classes, and no-results/error output",
    existing_evidence_refs: ["WPHX-320.01", "WPHX-320.03", "WPHX-320.04"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-308", "WPHX-309", "WPHX-310", "WPHX-314"],
    blockers: [
      "No installed route matrix executes representative default-theme page/search/archive/404 requests through real template-loader.",
      "No generated candidate overlay exists for block-template hierarchy or bundled default-theme template files.",
      "No DOM/HTTP/query-state diff records template selection, fallback order, body classes, and rendered empty/error states."
    ]
  },
  {
    id: "default-theme-pattern-registration-and-template-parts",
    kind: "installed_http_pattern_registry",
    route_family: "pattern_registry_and_parts",
    representative_routes: ["/", "/wp-admin/site-editor.php"],
    default_theme_scope: ["patterns", "parts", "block templates", "site editor handoff"],
    upstream_refs: [
      "src/wp-includes/block-patterns.php",
      "src/wp-includes/class-wp-block-patterns-registry.php",
      "src/wp-includes/class-wp-block-pattern-categories-registry.php",
      "src/wp-content/themes/twentytwentyfive/patterns/hero-full-width-image.php",
      "src/wp-content/themes/twentytwentyfive/patterns/footer.php",
      "src/wp-content/themes/twentytwentyfour/patterns/footer.php",
      "src/wp-content/themes/twentytwentythree/patterns/call-to-action.php",
      "tests/phpunit/tests/theme/wpThemeGetBlockPatterns.php",
      "tests/phpunit/tests/block-templates/buildBlockTemplateResultFromFile.php"
    ],
    scope:
      "theme pattern directory scanning, pattern headers/categories, template part inclusion, block pattern rendering, site-editor registry handoff, and installed HTML output",
    existing_evidence_refs: ["WPHX-320.01", "WPHX-320.04"],
    cross_domain_handoffs: ["WPHX-310", "WPHX-314", "WPHX-316", "WPHX-400", "WPHX-500"],
    blockers: [
      "The current WPHX-320.04 fixture executes selected pattern PHP files directly; no installed pattern registry or template-loader path consumes them yet.",
      "No generated overlay exists for bundled pattern PHP files or block-pattern registry/template-part paths.",
      "No installed/browser diff records pattern registration, template-part inclusion, site-editor availability, or rendered block output parity."
    ]
  },
  {
    id: "default-theme-functions-support-assets-and-bindings",
    kind: "installed_http_theme_setup_assets",
    route_family: "theme_setup_assets",
    representative_routes: ["/", "/fixture-gallery-post/", "/wp-admin/post.php?post=1&action=edit"],
    default_theme_scope: ["twentytwentyfive", "twentytwentyfour", "theme supports", "assets", "block styles", "block bindings"],
    upstream_refs: [
      "src/wp-content/themes/twentytwentyfive/functions.php",
      "src/wp-content/themes/twentytwentyfour/functions.php",
      "src/wp-includes/class-wp-block-bindings-registry.php",
      "src/wp-includes/class-wp-block-bindings-source.php",
      "src/wp-includes/style-engine.php",
      "tests/phpunit/tests/theme/support.php",
      "tests/phpunit/tests/link/themeFile.php"
    ],
    scope:
      "after_setup_theme/init/wp_enqueue_scripts execution under installed bootstrap, post-format support, editor styles, stylesheet paths, block styles, pattern categories, block bindings, and asset requests",
    existing_evidence_refs: ["WPHX-320.01", "WPHX-320.03", "WPHX-320.05"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-310", "WPHX-313", "WPHX-314", "WPHX-316"],
    blockers: [
      "The current WPHX-320.05 fixture executes functions.php callbacks under deterministic stubs; no installed WordPress hook/bootstrap route has consumed them yet.",
      "No generated overlay exists for default-theme functions.php, asset paths, block-style, or block-binding paths.",
      "No browser/admin diff records enqueued asset URLs, editor/front-end styles, post-format binding output, block style CSS, or PHP hook order parity."
    ]
  },
  {
    id: "default-theme-style-variation-global-styles-rendering",
    kind: "installed_http_stylesheet_dom",
    route_family: "global_styles",
    representative_routes: ["/?style_variation=default", "/wp-admin/site-editor.php?canvas=edit"],
    default_theme_scope: ["theme.json", "style variations", "global styles", "style engine"],
    upstream_refs: [
      "src/wp-includes/theme.json",
      "src/wp-includes/class-wp-theme-json.php",
      "src/wp-includes/class-wp-theme-json-resolver.php",
      "src/wp-includes/global-styles-and-settings.php",
      "src/wp-includes/style-engine.php",
      "src/wp-content/themes/twentytwentyfive/theme.json",
      "src/wp-content/themes/twentytwentyfour/theme.json",
      "tests/phpunit/tests/theme/wpThemeJson.php",
      "tests/phpunit/tests/theme/wpThemeJsonResolver.php",
      "tests/phpunit/tests/theme/wpGetGlobalStylesheet.php"
    ],
    scope:
      "global styles resolution, theme.json merges, style variation files, style-engine CSS, block supports, user/global-styles database state, and browser-observed stylesheet output",
    existing_evidence_refs: ["WPHX-310.10", "WPHX-320.01", "WPHX-320.03"],
    cross_domain_handoffs: ["WPHX-304", "WPHX-310", "WPHX-314", "WPHX-316", "WPHX-400"],
    blockers: [
      "No installed default-theme runner compares global stylesheet output through front-end and site-editor routes.",
      "No seeded database state exists for user global styles, style variation selection, and cache invalidation.",
      "No generated overlay exists for theme.json/global styles/style-engine paths or bundled default-theme JSON/style files."
    ]
  },
  {
    id: "default-theme-visual-regression-and-admin-adjacent-surfaces",
    kind: "browser_visual_regression",
    route_family: "visual_and_admin_theme_adjacent",
    representative_routes: ["/", "/2018/11/03/block-image/", "/wp-admin/widgets.php", "/wp-admin/nav-menus.php"],
    default_theme_scope: ["front-end screenshots", "widgets", "menus", "Customizer/site-editor/admin-adjacent theme surfaces"],
    upstream_refs: [
      "tests/visual-regression/specs/visual-snapshots.test.js",
      "tests/visual-regression/playwright.config.js",
      "tests/performance/specs/admin.test.js",
      "src/wp-includes/theme-previews.php",
      "src/wp-includes/theme-templates.php"
    ],
    scope:
      "browser screenshots, layout/asset/CSS parity, default-theme visual baselines, admin theme-adjacent widgets/nav-menus/customizer/site-editor handoffs, and reproducible performance/visual metrics",
    existing_evidence_refs: ["WPHX-320.03", "WPHX-310.10", "WPHX-315.09", "WPHX-316.08"],
    cross_domain_handoffs: ["WPHX-315", "WPHX-316", "WPHX-400", "WPHX-500", "WPHX-700"],
    blockers: [
      "No Playwright visual-regression runner compares installed oracle and generated candidate packages for default-theme front-end and theme-adjacent admin routes.",
      "No browser asset, screenshot, accessibility, viewport, or performance baseline is reproducible against candidate overlays.",
      "No generated overlay exists for default-theme public files, theme-adjacent admin routes, browser packages, or editor/site-editor packages."
    ]
  }
];

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function upstreamRecord(relativePath) {
  const path = join(UPSTREAM_ROOT, relativePath);
  if (!existsSync(path)) throw new Error(`Missing upstream reference: ${path}`);
  return {
    path,
    relative_path: relativePath,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-320-default-theme-installed-rendering-gates`);
    if (readFileSync(path, "utf8") !== body) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-default-theme-installed-rendering-gates`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  for (const dependency of EVIDENCE_DEPENDENCIES) {
    if (!existsSync(dependency.path)) throw new Error(`Missing evidence dependency: ${dependency.path}`);
  }

  const upstreamSources = [...new Set(UPSTREAM_SOURCE_FILES)].map(upstreamRecord);
  const upstreamTests = [...new Set(UPSTREAM_TEST_FILES)].map(upstreamRecord);
  const upstreamByPath = new Map([...upstreamSources, ...upstreamTests].map((record) => [record.relative_path, record]));
  const installedGates = SELECTED_INSTALLED_GATES.map((gate) => ({
    ...gate,
    upstream_references: gate.upstream_refs.map((path) => upstreamByPath.get(path) ?? upstreamRecord(path)),
    provisioning_status: "blocked",
    classification: "blocked_no_wphx_320_installed_default_theme_rendering_runner",
    generated_overlay_required_before_candidate_divergence: true
  }));

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "installed_default_theme_rendering_gate_declaration",
    artifact_scope: "selected_installed_http_browser_visual_performance_default_theme_scope",
    behavior_parity_claimed: false,
    installed_theme_rendering_execution_claimed: false,
    installed_wordpress_bootstrap_claimed: false,
    browser_e2e_execution_claimed: false,
    browser_or_visual_parity_claimed: false,
    performance_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_existing_theme_file_claimed: false,
    hxx_template_ownership_claimed_for_existing_theme_files: false,
    candidate_generated_overlay_claimed: false,
    generated_original_path_adapter_claimed: false,
    selected_gate_scope_declared: true,
    selected_installed_gate_count: installedGates.length,
    selected_upstream_source_count: upstreamSources.length,
    selected_upstream_test_count: upstreamTests.length,
    upstream_source_authority: {
      path: UPSTREAM_ROOT,
      role: "read-only WordPress 7.0 oracle checkout",
      source_roots: ["src/wp-includes", "src/wp-content/themes", "src/wp-admin"],
      test_roots: ["tests/phpunit/tests", "tests/performance", "tests/visual-regression"]
    },
    inputs: {
      runner: inputRecord(RUNNER),
      evidence_dependencies: EVIDENCE_DEPENDENCIES.map((dependency) => ({
        ...dependency,
        ...inputRecord(dependency.path)
      })),
      upstream_sources: upstreamSources,
      upstream_tests: upstreamTests
    },
    selected_installed_default_theme_rendering_gates: installedGates,
    future_runner_requirements: [
      "Provision oracle and candidate installed WordPress roots with identical database seeds, users, options, rewrite rules, active theme, salts, uploads/media, post/comment/term fixtures, global-styles state, cache state, locales, plugins, and browser assets.",
      "Dispatch selected front-end and admin/theme-adjacent HTTP requests through real WordPress bootstrap, template-loader, block-template resolution, functions.php hooks, block rendering, style engine, and asset enqueue paths, not deterministic bridge routers.",
      "Require a non-empty generated candidate overlay manifest before any candidate package file differs from copied upstream default-theme, template-loader, block-template, theme, global-style, or browser/admin source files.",
      "Compare HTTP status, redirects, headers, canonical/meta/body-class output, rendered DOM fragments, block comments, stylesheets, asset URLs, PHP logs, hook traces, selected database reads/writes, filesystem/media reads, browser console/network traces, screenshot baselines, and performance metrics where applicable.",
      "Run selected upstream performance and visual-regression specs when real installed oracle/candidate roots and reproducible browser baselines exist.",
      "Keep HXX/segment-plan adoption explicit: existing bundled mixed PHP/HTML files require caller-scope, include-order, global, output-buffer, hook, template-loader, and browser evidence before ownership claims."
    ],
    cross_domain_handoffs: [
      {
        owner: "WPHX-307/WPHX-308",
        reason: "Posts, pages, search/archive queries, comments, terms, loop globals, and database-backed content state remain posts/query and taxonomy/comment ownership."
      },
      {
        owner: "WPHX-309/WPHX-310",
        reason: "Rewrite/canonical/template-loader, theme discovery, theme.json/global styles, template hierarchy, widgets, nav menus, Customizer, and site-editor handoffs remain routing/theme ownership."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "Feeds/embeds, asset URLs, uploads/media paths, image files, filesystem reads, and HTTP transport remain HTTP/media/filesystem ownership."
      },
      {
        owner: "WPHX-314/WPHX-400/WPHX-500",
        reason: "Block rendering, block supports, block bindings, global styles, interactivity, browser/editor packages, and Gutenberg site-editor behavior remain block/browser/Gutenberg ownership."
      },
      {
        owner: "WPHX-315/WPHX-316/WPHX-319/WPHX-700",
        reason: "Theme-adjacent admin screens, capabilities, nonces, update/theme install flows, browser/e2e, visual, performance, security, and release-grade gates remain admin/update/distribution ownership."
      }
    ],
    non_claims: [
      "This artifact declares WPHX-320 installed/browser default-theme rendering gate scope only; it does not execute installed WordPress routes, Playwright specs, visual regression, performance runs, template-loader, block rendering, or browser requests.",
      "No generated public PHP replacement for bundled default-theme files, template-loader files, block-template files, pattern files, functions.php files, theme.json/style files, browser packages, or admin/theme-adjacent files is claimed.",
      "No Haxe-owned existing default-theme runtime logic, HXX ownership of existing bundled mixed PHP/HTML theme files, installed theme rendering parity, browser/visual/performance parity, database-backed theme state, generated overlay, or generated original-path adapter ownership is claimed.",
      "The WPHX-320.04 and WPHX-320.05 copied fixtures remain bridge evidence only. They do not prove installed pattern registry, functions.php bootstrap, template-loader, or browser rendering parity.",
      "The selected installed gates are future blockers and scope declarations; their source/test hashes are not pass/pass installed execution evidence."
    ],
    validation_result: {
      status: "passed",
      selected_installed_gate_count: installedGates.length,
      selected_upstream_source_count: upstreamSources.length,
      selected_upstream_test_count: upstreamTests.length,
      provisioning_status: "blocked",
      behavior_parity_claimed: false,
      installed_theme_rendering_execution_claimed: false,
      browser_e2e_execution_claimed: false,
      future_runner_required: true
    }
  };

  const receipt = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    status: "passed",
    generator: RUNNER,
    evidence: {
      manifest: OUT,
      surface_manifest: "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json",
      hxx_pilot_manifest: "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json",
      upstream_browser_ratchets_manifest: "manifests/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json",
      pattern_fixture_manifest: "manifests/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json",
      functions_fixture_manifest: "manifests/wp-core/wphx-320-05-default-theme-functions-oracle-fixture.v1.json",
      upstream_lock: "upstream.lock.json"
    },
    summary:
      "Declares seven selected WPHX-320 installed/browser default-theme rendering gates over home, single-post, page/search/archive/404 hierarchy, pattern registry/template parts, functions.php/theme supports/assets/block bindings, global styles/style variations, and visual/performance/admin-adjacent browser surfaces. Every selected gate remains blocked until real installed oracle/candidate roots, generated-overlay discipline, database/content/media/theme state, template-loader/block-rendering execution, and browser/HTTP/DOM/visual/performance diff evidence exist.",
    checks: [
      "npm run wp:core:wphx-320-default-theme-installed-rendering-gates",
      "npm run wp:core:wphx-320-default-theme-installed-rendering-gates:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        selected_installed_gate_count: installedGates.length,
        provisioning_status: "blocked",
        behavior_parity_claimed: false,
        installed_theme_rendering_execution_claimed: false,
        output: OUT,
        receipt: RECEIPT
      },
      null,
      2
    )
  );
}

main();
