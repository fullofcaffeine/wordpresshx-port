#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { chromium } from "playwright";

const checkOnly = new Set(process.argv.slice(2)).has("--check");
const ISSUE = { id: "wordpresshx-w91.2.4", external_ref: "WPHX-404", title: "WPHX-404 — F9 React/TSX spike" };
const RECORDED_AT = "2026-07-13T04:12:54.000Z";
const UPSTREAM_COMMIT = "98a796c8780c480ef7bcfe03c42302d9564d785c";
const GENES_COMMIT = "45a020e0e9abb9d335020be014afff09b6f8c02f";
const UPSTREAM_PATH = "packages/block-library/src/table-of-contents/list.tsx";
const BUILD = "build/genes-ts/wphx-404-table-of-contents";
const FIXTURE = "fixtures/genes-ts/react-table-of-contents";
const MANIFEST = "manifests/genes-ts/wphx-404-f9-react-tsx.v1.json";
const RECEIPT = "receipts/genes-ts/wphx-404-f9-react-tsx.v1.json";

function run(name, args, options = {}) {
  return execFileSync(name, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100
  }).trim();
}

function runCaptured(name, args, options = {}) {
  try {
    return { status: "passed", stdout: run(name, args, options), stderr: "" };
  } catch (error) {
    return {
      status: "failed",
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message).trim()
    };
  }
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function sha(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function shaFile(path) {
  return sha(readFileSync(path));
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}

function treeDigest(dir) {
  const records = files(dir).map((path) => ({
    path: relative(dir, path),
    sha256: shaFile(path),
    bytes: statSync(path).size
  }));
  return { sha256: sha(JSON.stringify(records)), files: records };
}

function assertNoUnsafeTypes(path) {
  const matches = [];
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
    if (/\bas (?:any|unknown)\b|:\s*(?:any|unknown)\b|<\s*(?:any|unknown)\b/.test(line))
      matches.push(`${path}:${index + 1}: ${line}`);
  });
  if (matches.length)
    throw new Error(`unsafe generated candidate types:\n${matches.join("\n")}`);
}

function lockedSource(path) {
  return `${run("git", ["-C", "../gutenberg", "show", `${UPSTREAM_COMMIT}:${path}`])}\n`;
}

const entrySource = (candidate) => `
import type { ReactElement } from "react";
${candidate
    ? 'import { TableOfContentsList } from "./wphx/fixtures/genes/react/TableOfContentsList.js";'
    : 'import UpstreamList from "./list.js";'}

interface HeadingData {
  content: string;
  level: number;
  link: string;
}

interface NestedHeadingData {
  heading: HeadingData;
  children: NestedHeadingData[] | null;
}

interface ClickEvent {
  preventDefault(): void;
}

interface ListProps {
  nestedHeadingList: NestedHeadingData[];
  disableLinkActivation: boolean;
  onClick: (event: ClickEvent) => void;
  ordered: boolean;
}

interface ReactRoot {
  render(node: ReactElement): void;
}

declare const ReactDOM: {
  createRoot(container: Element): ReactRoot;
};

const List = (props: ListProps): ReactElement => ${candidate
    ? "TableOfContentsList.Component(props)"
    : "UpstreamList(props)"};

const orderedHeadings: NestedHeadingData[] = [
  {
    heading: { content: "Introduction", level: 2, link: "#intro" },
    children: [
      { heading: { content: "API surface", level: 3, link: "#api" }, children: null },
      { heading: { content: "Plain heading", level: 3, link: "" }, children: null }
    ]
  },
  { heading: { content: "Examples", level: 2, link: "#examples" }, children: null }
];

const unorderedHeadings: NestedHeadingData[] = [
  {
    heading: { content: "Notes", level: 2, link: "#notes" },
    children: [
      { heading: { content: "Deep note", level: 3, link: "#deep" }, children: null }
    ]
  }
];

let prevented = 0;
const onPrevented = (event: ClickEvent): void => {
  event.preventDefault();
  prevented += 1;
  const status = document.getElementById("status");
  if (status !== null)
    status.textContent = ` + "`prevented:${prevented}`" + `;
};

const root = document.getElementById("root");
if (root === null)
  throw new Error("Missing #root");

ReactDOM.createRoot(root).render(
  <main aria-labelledby="title">
    <h1 id="title">Table of contents parity</h1>
    <section aria-labelledby="ordered-title">
      <h2 id="ordered-title">Ordered and disabled</h2>
      <ol id="ordered-list">
        <List nestedHeadingList={orderedHeadings} disableLinkActivation={true} onClick={onPrevented} ordered={true} />
      </ol>
    </section>
    <section aria-labelledby="unordered-title">
      <h2 id="unordered-title">Unordered and active</h2>
      <ul id="unordered-list">
        <List nestedHeadingList={unorderedHeadings} disableLinkActivation={false} onClick={onPrevented} ordered={false} />
      </ul>
    </section>
    <p id="status" aria-live="polite">prevented:0</p>
  </main>
);
`;

function materializeSources() {
  rmSync(BUILD, { recursive: true, force: true });
  write(join(BUILD, "oracle-src/list.tsx"), lockedSource(UPSTREAM_PATH));
  write(join(BUILD, "oracle-src/utils.ts"), lockedSource("packages/block-library/src/table-of-contents/utils.ts"));
  write(join(BUILD, "oracle-src/entry.tsx"), entrySource(false));
}

function tsconfig(rootDir, outDir) {
  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      module: "ES2022",
      moduleResolution: "Bundler",
      strict: true,
      noEmitOnError: true,
      allowUmdGlobalAccess: true,
      jsx: "react",
      sourceMap: true,
      inlineSources: true,
      rootDir,
      outDir,
      typeRoots: [resolve("../genes/node_modules/@types")],
      types: ["react", "react-dom"]
    },
    include: [`${rootDir}/**/*.ts`, `${rootDir}/**/*.tsx`]
  };
}

function compileSources(env) {
  const tsc = resolve("../genes/node_modules/typescript/bin/tsc");
  write(join(BUILD, "tsconfig.oracle.json"), `${JSON.stringify(tsconfig("oracle-src", "oracle-dist"), null, 2)}\n`);
  run("node", [tsc, "-p", join(BUILD, "tsconfig.oracle.json")], { env });

  run("haxe", [`${FIXTURE}/build.hxml`], { env });
  write(join(BUILD, "candidate-src/entry.tsx"), entrySource(true));
  write(join(BUILD, "tsconfig.candidate.json"), `${JSON.stringify(tsconfig("candidate-src", "candidate-dist"), null, 2)}\n`);
  run("node", [tsc, "-p", join(BUILD, "tsconfig.candidate.json")], { env });

  assertNoUnsafeTypes(join(BUILD, "candidate-src/wphx/fixtures/genes/react/TableOfContentsList.tsx"));
}

function runTs2hx(env) {
  run("yarn", ["--cwd", "tools/ts2hx", "build"], { cwd: resolve("../genes"), env });
  const project = join(BUILD, "tsconfig.ts2hx.json");
  write(project, `${JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "Bundler",
      strict: true,
      allowUmdGlobalAccess: true,
      jsx: "react",
      typeRoots: [resolve("../genes/node_modules/@types")],
      types: ["react"]
    },
    include: ["oracle-src/list.tsx", "oracle-src/utils.ts"]
  }, null, 2)}\n`);
  const out = resolve(BUILD, "ts2hx");
  const result = runCaptured("node", [
    resolve("../genes/tools/ts2hx/dist/cli.js"),
    "--project", resolve(project),
    "--out", out,
    "--base-package", "wphx_f9_table_of_contents",
    "--clean"
  ], { env });
  const generatedFiles = existsSync(out) ? files(out).map((path) => relative(out, path)) : [];
  const diagnostics = `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/).filter(Boolean);
  if (result.status !== "passed")
    throw new Error(`ts2hx conversion failed:\n${diagnostics.join("\n")}`);

  const weakHaxeMarkers = files(out).filter((path) => path.endsWith(".hx")).flatMap((path) => {
    const matches = [];
    readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
      const marker = /\bDynamic\b|\buntyped\b|\bUnknown\b|\bcast\b|\bjs\.Syntax\b|\bUnsupported\b|\bTODO\b/.exec(line)?.[0];
      if (marker !== undefined)
        matches.push({ path: relative(out, path), line: index + 1, marker });
    });
    return matches;
  });
  if (weakHaxeMarkers.length)
    throw new Error(`ts2hx emitted weak Haxe markers:\n${JSON.stringify(weakHaxeMarkers, null, 2)}`);

  const smokePackage = "wphx_f9_table_of_contents";
  write(join(out, smokePackage, "Ts2hxSmoke.hx"), `package ${smokePackage};

/** Compile and strict-roundtrip smoke for the migrated React component. */
class Ts2hxSmoke {
  static function main(): Void {
    final headings: Array<Utils.NestedHeadingData> = [{
      heading: {content: "Introduction", level: 2, link: "#intro"},
      children: null
    }];
    final component = List.TableOfContentsList({
      nestedHeadingList: headings,
      disableLinkActivation: true,
      ordered: true
    });
    final nested = Utils.linearToNestedHeadingList([{
      content: "Introduction",
      level: 2,
      link: "#intro"
    }]);
    if (component == null || nested.length != 1)
      throw "ts2hx React roundtrip smoke failed";
  }
}
`);
  const roundtripDir = join(BUILD, "ts2hx-roundtrip");
  const haxeResult = runCaptured("haxe", [
    "-lib", "genes-ts",
    "-cp", out,
    "-main", `${smokePackage}.Ts2hxSmoke`,
    "-js", join(roundtripDir, "index.tsx"),
    "-D", "genes.ts",
    "-debug",
    "-D", "source-map-content",
    "-dce", "full"
  ], { env });
  if (haxeResult.status !== "passed")
    throw new Error(`ts2hx generated Haxe compile failed:\n${haxeResult.stderr || haxeResult.stdout}`);

  const roundtripProject = join(BUILD, "tsconfig.ts2hx-roundtrip.json");
  write(roundtripProject, `${JSON.stringify(tsconfig("ts2hx-roundtrip", "ts2hx-roundtrip-dist"), null, 2)}\n`);
  const tsc = resolve("../genes/node_modules/typescript/bin/tsc");
  const strictResult = runCaptured("node", [tsc, "-p", roundtripProject], { env });
  if (strictResult.status !== "passed")
    throw new Error(`ts2hx strict TSX roundtrip failed:\n${strictResult.stderr || strictResult.stdout}`);

  files(join(roundtripDir, smokePackage)).filter((path) => path.endsWith(".tsx")).forEach(assertNoUnsafeTypes);
  return {
    status: "passed",
    generated_files: generatedFiles,
    diagnostics: diagnostics.slice(0, 80),
    weak_haxe_markers: weakHaxeMarkers,
    haxe_compile: "passed",
    strict_tsx_roundtrip: "passed",
    generic_compiler_issue: "genes-je4",
    landed_compiler_commit: GENES_COMMIT,
    unsupported_markers: existsSync(out)
      ? files(out).filter((path) => path.endsWith(".hx")).flatMap((path) => {
          const text = readFileSync(path, "utf8");
          return text.includes("Unsupported") || text.includes("TODO") ? [relative(out, path)] : [];
        })
      : []
  };
}

function contentType(path) {
  return ({ ".js": "text/javascript", ".map": "application/json", ".html": "text/html" })[extname(path)] ?? "application/octet-stream";
}

function pageHtml(mode) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>F9 React parity</title>
<style>
html { background: #fff; }
body { margin: 0; color: #1e1e1e; font: 16px/1.5 Arial, sans-serif; }
#root { box-sizing: border-box; width: 640px; padding: 24px; }
h1 { font-size: 26px; margin: 0 0 20px; }
h2 { font-size: 18px; margin: 16px 0 8px; }
ol, ul { margin: 0; padding-left: 28px; }
a { color: #3858e9; }
a[aria-disabled="true"] { color: #646970; }
#status { border-top: 1px solid #dcdcde; margin: 20px 0 0; padding-top: 8px; }
</style>
<script src="/vendor/react.js"></script>
<script src="/vendor/react-dom.js"></script>
</head>
<body><div id="root"></div><script type="module" src="/${mode}/entry.js"></script></body>
</html>`;
}

async function withServer(callback) {
  const roots = {
    oracle: resolve(BUILD, "oracle-dist"),
    candidate: resolve(BUILD, "candidate-dist")
  };
  const vendor = {
    "/vendor/react.js": resolve("../genes/node_modules/react/umd/react.development.js"),
    "/vendor/react-dom.js": resolve("../genes/node_modules/react-dom/umd/react-dom.development.js")
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/oracle.html" || pathname === "/candidate.html") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(pageHtml(pathname.slice(1, -5)));
      return;
    }
    const vendorPath = vendor[pathname];
    const match = /^\/(oracle|candidate)\/(.+)$/.exec(pathname);
    const path = vendorPath ?? (match === null ? null : resolve(roots[match[1]], match[2]));
    if (path === null || !existsSync(path)) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(path), "cache-control": "no-store" });
    response.end(readFileSync(path));
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  try {
    const address = server.address();
    if (typeof address === "string" || address === null)
      throw new Error("browser server did not allocate a TCP port");
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
  }
}

async function capturePage(browser, baseUrl, mode) {
  const page = await browser.newPage({ viewport: { width: 700, height: 560 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${baseUrl}/${mode}.html`, { waitUntil: "networkidle" });
  await page.locator("#status").waitFor();
  const root = page.locator("#root");
  const dom = await root.innerHTML();
  const aria = await root.ariaSnapshot();
  const layout = await root.locator("*").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      text: element.childElementCount === 0 ? element.textContent : null,
      href: element.getAttribute("href"),
      ariaDisabled: element.getAttribute("aria-disabled"),
      box: [box.x, box.y, box.width, box.height],
      display: style.display,
      color: style.color
    };
  }));
  const screenshot = await root.screenshot();
  // The component intentionally marks the link aria-disabled while retaining
  // a click handler that prevents navigation. Force the user-event dispatch so
  // Playwright does not short-circuit on the accessibility state under test.
  await page.locator('a[href="#intro"]').click({ force: true });
  const interaction = {
    status: await page.locator("#status").textContent(),
    hash: await page.evaluate(() => location.hash),
    activeText: await page.evaluate(() => document.activeElement?.textContent ?? null)
  };
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#status").waitFor();
  const focusOrder = [];
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Tab");
    focusOrder.push(await page.evaluate(() => ({
      text: document.activeElement?.textContent ?? null,
      href: document.activeElement?.getAttribute("href") ?? null
    })));
  }
  await page.close();
  if (errors.length)
    throw new Error(`${mode} browser errors:\n${errors.join("\n")}`);
  return { dom, aria, layout, interaction, focusOrder, screenshot };
}

async function browserGate() {
  const browser = await chromium.launch({ headless: true });
  try {
    return await withServer(async (baseUrl) => {
      const oracle = await capturePage(browser, baseUrl, "oracle");
      const candidate = await capturePage(browser, baseUrl, "candidate");
      const screenshotEqual = oracle.screenshot.equals(candidate.screenshot);
      const comparisons = {
        dom: oracle.dom === candidate.dom,
        accessibility: oracle.aria === candidate.aria,
        layout: JSON.stringify(oracle.layout) === JSON.stringify(candidate.layout),
        interaction: JSON.stringify(oracle.interaction) === JSON.stringify(candidate.interaction),
        keyboard_focus: JSON.stringify(oracle.focusOrder) === JSON.stringify(candidate.focusOrder),
        screenshot_bytes: screenshotEqual
      };
      const failures = Object.entries(comparisons).filter(([, passed]) => !passed).map(([name]) => name);
      if (failures.length) {
        write(join(BUILD, "browser-diff.json"), `${JSON.stringify({
          oracle: { ...oracle, screenshot: undefined },
          candidate: { ...candidate, screenshot: undefined }
        }, null, 2)}\n`);
        throw new Error(`browser parity failures: ${failures.join(", ")}`);
      }
      return {
        viewport: { width: 700, height: 560, device_scale_factor: 1 },
        comparisons,
        screenshot_bytes: oracle.screenshot.length,
        aria_snapshot: oracle.aria,
        interaction: oracle.interaction,
        keyboard_focus: oracle.focusOrder
      };
    });
  } finally {
    await browser.close();
  }
}

function sourceMapGate() {
  const oracleMapPath = join(BUILD, "oracle-dist/list.js.map");
  const candidateJsMapPath = join(BUILD, "candidate-dist/wphx/fixtures/genes/react/TableOfContentsList.js.map");
  const candidateHaxeMapPath = join(BUILD, "candidate-src/wphx/fixtures/genes/react/TableOfContentsList.tsx.map");
  const oracleMap = JSON.parse(readFileSync(oracleMapPath, "utf8"));
  const candidateJsMap = JSON.parse(readFileSync(candidateJsMapPath, "utf8"));
  const candidateHaxeMap = JSON.parse(readFileSync(candidateHaxeMapPath, "utf8"));
  const upstream = readFileSync(join(BUILD, "oracle-src/list.tsx"), "utf8");
  const haxe = readFileSync(join(FIXTURE, "src/wphx/fixtures/genes/react/TableOfContentsList.hx"), "utf8");
  const candidateTsx = readFileSync(join(BUILD, "candidate-src/wphx/fixtures/genes/react/TableOfContentsList.tsx"), "utf8");
  const checks = {
    oracle_js_to_upstream_tsx: oracleMap.sourcesContent?.includes(upstream) === true,
    candidate_js_to_generated_tsx: candidateJsMap.sourcesContent?.includes(candidateTsx) === true,
    candidate_tsx_to_haxe: candidateHaxeMap.sourcesContent?.includes(haxe) === true,
    oracle_source_map_url: readFileSync(join(BUILD, "oracle-dist/list.js"), "utf8").includes("sourceMappingURL=list.js.map"),
    candidate_source_map_url: readFileSync(join(BUILD, "candidate-dist/wphx/fixtures/genes/react/TableOfContentsList.js"), "utf8").includes("sourceMappingURL=TableOfContentsList.js.map")
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failures.length)
    throw new Error(`source-map failures: ${failures.join(", ")}`);
  return {
    checks,
    oracle_map: shaFile(oracleMapPath),
    candidate_js_map: shaFile(candidateJsMapPath),
    candidate_haxe_map: shaFile(candidateHaxeMapPath),
    composition: "two-stage Haxe-to-TSX and TSX-to-JS maps validated; automatic map composition is not claimed"
  };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== content)
      throw new Error(`${path} is missing or stale`);
  } else {
    write(path, content);
  }
}

async function main() {
  const toolchain = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
  const env = { ...process.env, PATH: `${dirname(toolchain.tools.haxe.executable)}:${process.env.PATH}` };
  if (run("git", ["-C", "../gutenberg", "rev-parse", "HEAD"]) !== UPSTREAM_COMMIT)
    throw new Error("Gutenberg checkout does not match the locked F9 baseline");
  if (run("git", ["-C", "../genes", "rev-parse", "HEAD"]) !== GENES_COMMIT)
    throw new Error("genes-ts checkout does not match the locked compiler baseline");

  materializeSources();
  compileSources(env);
  const ts2hx = runTs2hx(env);
  const browser = await browserGate();
  const sourceMaps = sourceMapGate();
  const candidateModule = join(BUILD, "candidate-src/wphx/fixtures/genes/react/TableOfContentsList.tsx");
  const manifest = {
    schema: "wphx.genes-ts-f9-react-tsx.v1",
    issue: ISSUE.external_ref,
    recorded_at: RECORDED_AT,
    upstream: {
      repository: "../gutenberg",
      commit: UPSTREAM_COMMIT,
      package: "@wordpress/block-library",
      source_path: UPSTREAM_PATH,
      source_sha256: shaFile(join(BUILD, "oracle-src/list.tsx"))
    },
    candidate: {
      source_path: `${FIXTURE}/src/wphx/fixtures/genes/react/TableOfContentsList.hx`,
      source_sha256: shaFile(`${FIXTURE}/src/wphx/fixtures/genes/react/TableOfContentsList.hx`),
      generated_module_sha256: shaFile(candidateModule),
      generated_tree: treeDigest(join(BUILD, "candidate-src")),
      unsafe_generated_user_types: 0
    },
    compiler: {
      genes_ts_commit: GENES_COMMIT,
      generated_target: "strict TypeScript/TSX followed by browser ES2022 modules",
      ts2hx
    },
    gates: {
      browser,
      visual: {
        method: "same-browser, same-viewport exact component PNG byte comparison",
        passed: browser.comparisons.screenshot_bytes
      },
      accessibility: {
        method: "Playwright ARIA snapshot plus keyboard focus-order comparison",
        passed: browser.comparisons.accessibility && browser.comparisons.keyboard_focus
      },
      source_maps: sourceMaps
    },
    validation_result: {
      status: "passed",
      strict_types: true,
      browser_parity: true,
      visual_parity: true,
      accessibility_parity: true,
      source_map_chain: true,
      ts2hx_status: ts2hx.status
    },
    non_claims: [
      "This is one bounded React/TSX feasibility slice, not broad Gutenberg package translation or ownership.",
      "The Haxe candidate proves observable component parity only for the recorded fixture data and interactions.",
      "Automatic Haxe-to-TSX-to-JavaScript source-map composition is not claimed; both source-map stages are validated independently.",
      "No gutenberghx repository split or WordPress 7.0 distribution baseline change is authorized by this receipt alone."
    ]
  };
  writeOrCheck(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-404-f9-react-tsx",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    generator: "tools/genes-ts/run-f9-react-tsx-spike.mjs",
    evidence_class: "bounded_react_tsx_browser_parity_feasibility",
    artifact_scope: "gutenberg_table_of_contents_list_component",
    artifacts: [
      { path: MANIFEST, role: "F9 browser, visual, accessibility, and source-map evidence", sha256: shaFile(MANIFEST) },
      { path: `${FIXTURE}/src/wphx/fixtures/genes/react/TableOfContentsList.hx`, role: "Haxe-owned component candidate", sha256: shaFile(`${FIXTURE}/src/wphx/fixtures/genes/react/TableOfContentsList.hx`) }
    ],
    verification_commands: ["npm run genes-ts:f9-react-tsx", "npm run genes-ts:f9-react-tsx:check"],
    validation_result: manifest.validation_result,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  return manifest;
}

try {
  const manifest = await main();
  console.log(JSON.stringify({ status: "passed", check: checkOnly, result: manifest.validation_result }, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
