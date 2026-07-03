#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T12:00:00Z";
const ISSUE = {
  id: "wordpresshx-9esi",
  external_ref: "WPHX-COMP-PHP-FILE-OWNERSHIP-INVENTORIES",
  title: "Inventory HTTP/embed/oEmbed whole-file ownership gates"
};
const RUNNER = "tools/wphx-php/run-file-ownership-inventories.mjs";
const MANIFEST = "manifests/wphx-php/file-ownership-inventories.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-file-ownership-inventories.v1.json";
const WORDPRESS_ROOT = "../wordpress-develop";
const WORDPRESS_SOURCE_ROOT = `${WORDPRESS_ROOT}/src`;

const TOKENIZE_SCRIPT = `
$path = $argv[1];
$tokens = token_get_all(file_get_contents($path));
$out = array();
foreach ($tokens as $token) {
  if (is_array($token)) {
    $out[] = array('id' => token_name($token[0]), 'text' => $token[1], 'line' => $token[2]);
  } else {
    $out[] = array('id' => $token, 'text' => $token, 'line' => null);
  }
}
echo json_encode($out, JSON_UNESCAPED_SLASHES);
`;

const FILES = [
  {
    key: "classWpHttp",
    original_path: "wp-includes/class-wp-http.php",
    source_path: `${WORDPRESS_SOURCE_ROOT}/wp-includes/class-wp-http.php`,
    expected_class: "WP_Http",
    current_evidence: [
      {
        manifest: "manifests/wphx-php/grouped-wp-http-helpers.v1.json",
        ownership_state: "compiler_emitted_original_path_shell",
        generated_path: "build/wp-core/wphx-comp-php-group-wp-http/generated/wp-includes/class-wp-http.php",
        claimed_symbols: [
          "processResponse",
          "chunkTransferDecode",
          "parse_url",
          "buildCookieHeader",
          "processHeaders",
          "is_ip_address",
          "browser_redirect_compatibility",
          "validate_redirects",
          "make_absolute_url",
          "block_request",
          "handle_redirects"
        ]
      }
    ],
    file_specific_gate_items: [
      "full request orchestration including preemptive response, blocking and nonblocking branches",
      "Requests integration, transport dispatch, redirects, cookies, streams, headers, proxy and TLS handoff",
      "http_api_debug/http_response hooks, exception conversion, warning behavior, and mbstring reset behavior",
      "live/fake transport boundary matrix plus packaged stack traces from wp-includes/class-wp-http.php",
      "selected upstream HTTP PHPUnit pass/pass ratchet and installed HTTP route/package probes"
    ],
    current_non_claim:
      "Selected WP_Http method-boundary shells are generated, but this is not full wp-includes/class-wp-http.php or WP_Http request/live transport ownership."
  },
  {
    key: "classWpEmbed",
    original_path: "wp-includes/class-wp-embed.php",
    source_path: `${WORDPRESS_SOURCE_ROOT}/wp-includes/class-wp-embed.php`,
    expected_class: "WP_Embed",
    current_evidence: [
      {
        manifest: "manifests/wphx-php/wp-embed-handlers.v1.json",
        ownership_state: "compiler_emitted_original_path_shell",
        generated_path: "build/wphx-php/wp-embed-handlers/generated/wp-includes/class-wp-embed.php",
        claimed_symbols: [
          "__construct",
          "run_shortcode",
          "maybe_run_ajax_cache",
          "register_handler",
          "unregister_handler",
          "get_embed_handler_html",
          "shortcode",
          "maybe_make_link",
          "delete_oembed_caches",
          "autoembed_callback",
          "autoembed",
          "cache_oembed",
          "find_oembed_post_id"
        ]
      }
    ],
    file_specific_gate_items: [
      "constructor hooks, shortcode registry timing, handler priority, and global $shortcode_tags restoration",
      "post meta/cache and oembed_cache post behavior including KSES filter removal/restoration",
      "Ajax/admin script output, REST/oEmbed handoff, output-buffer and mixed PHP/HTML segment behavior",
      "installed editor/admin route behavior plus packaged stack traces from wp-includes/class-wp-embed.php",
      "selected upstream embed PHPUnit pass/pass ratchet covering cache, filter, shortcode, and post-query paths"
    ],
    current_non_claim:
      "Selected WP_Embed handler/cache/autoembed shells are generated, but this is not full wp-includes/class-wp-embed.php ownership or installed editor/admin embed ownership."
  },
  {
    key: "classWpOembed",
    original_path: "wp-includes/class-wp-oembed.php",
    source_path: `${WORDPRESS_SOURCE_ROOT}/wp-includes/class-wp-oembed.php`,
    expected_class: "WP_oEmbed",
    current_evidence: [
      {
        manifest: "manifests/wphx-php/wp-oembed-providers.v1.json",
        ownership_state: "compiler_emitted_original_path_shell",
        generated_path: "build/wphx-php/wp-oembed-providers/generated/wp-includes/class-wp-oembed.php",
        claimed_symbols: ["_add_provider_early", "_remove_provider_early"]
      }
    ],
    file_specific_gate_items: [
      "provider table construction, early-provider queue replay, provider matching, and __call compatibility",
      "fetch/discover/network boundaries plus JSON/XML parsing and data2html behavior",
      "REST controller interaction, _strip_newlines filter timing, and provider filter mutation behavior",
      "live/fake oEmbed transport matrix plus packaged stack traces from wp-includes/class-wp-oembed.php",
      "selected upstream oEmbed PHPUnit pass/pass ratchet covering provider, discovery, parser, and REST paths"
    ],
    current_non_claim:
      "Selected WP_oEmbed early-provider queue shells are generated, but this is not full wp-includes/class-wp-oembed.php ownership, provider matching, remote fetch/discover, parsing, REST, or live oEmbed ownership."
  }
];

const HOOK_FUNCTIONS = new Set([
  "add_action",
  "add_filter",
  "apply_filters",
  "apply_filters_deprecated",
  "do_action",
  "do_action_ref_array",
  "has_filter",
  "remove_filter"
]);
const CALLBACK_FUNCTIONS = new Set(["call_user_func", "call_user_func_array", "is_callable", "preg_replace_callback"]);
const NETWORK_FUNCTIONS = new Set(["wp_remote_get", "wp_remote_request", "wp_safe_remote_get", "download_url"]);
const OUTPUT_FUNCTIONS = new Set(["echo", "print", "printf", "esc_url", "esc_html"]);
const WARNING_FUNCTIONS = new Set(["_deprecated_argument", "_deprecated_function", "_doing_it_wrong", "trigger_error"]);
const INCLUDE_TOKENS = new Set(["T_REQUIRE", "T_REQUIRE_ONCE", "T_INCLUDE", "T_INCLUDE_ONCE"]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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

function tokenize(path) {
  return JSON.parse(run("php", ["-r", TOKENIZE_SCRIPT, "--", path]));
}

function lineNumberForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function isTrivia(token) {
  return token.id === "T_WHITESPACE" || token.id === "T_COMMENT" || token.id === "T_DOC_COMMENT" || token.id === "T_OPEN_TAG";
}

function nextSignificant(tokens, index) {
  for (let current = index + 1; current < tokens.length; current += 1) {
    if (!isTrivia(tokens[current])) return current;
  }
  return -1;
}

function previousSignificant(tokens, index) {
  for (let current = index - 1; current >= 0; current -= 1) {
    if (!isTrivia(tokens[current])) return current;
  }
  return -1;
}

function tokenText(tokens, start, end) {
  return tokens
    .slice(start, end)
    .map((token) => token.text)
    .join("")
    .trim()
    .replace(/\s+/g, " ");
}

function findMatching(tokens, start, open, close) {
  let depth = 0;
  for (let current = start; current < tokens.length; current += 1) {
    if (tokens[current].text === open) depth += 1;
    if (tokens[current].text === close) {
      depth -= 1;
      if (depth === 0) return current;
    }
  }
  return -1;
}

function modifiersBefore(tokens, index) {
  const modifiers = [];
  for (let current = previousSignificant(tokens, index); current >= 0; current = previousSignificant(tokens, current)) {
    const token = tokens[current];
    if (["T_PUBLIC", "T_PROTECTED", "T_PRIVATE", "T_STATIC", "T_ABSTRACT", "T_FINAL", "T_READONLY"].includes(token.id)) {
      modifiers.push(token.id);
      continue;
    }
    break;
  }
  return modifiers.reverse();
}

function visibilityFromModifiers(modifiers) {
  if (modifiers.includes("T_PRIVATE")) return "private";
  if (modifiers.includes("T_PROTECTED")) return "protected";
  return "public";
}

function splitParamSegments(tokens) {
  const segments = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const text = tokens[index].text;
    if (["(", "[", "{"].includes(text)) depth += 1;
    if ([")", "]", "}"].includes(text)) depth -= 1;
    if (text === "," && depth === 0) {
      segments.push(tokens.slice(start, index));
      start = index + 1;
    }
  }
  const finalSegment = tokens.slice(start);
  if (finalSegment.some((token) => !isTrivia(token))) segments.push(finalSegment);
  return segments;
}

function parseParameter(segment) {
  const variableIndex = segment.findIndex((token) => token.id === "T_VARIABLE");
  if (variableIndex === -1) return null;
  const equalIndex = segment.findIndex((token) => token.text === "=");
  const beforeVariable = segment.slice(0, variableIndex).map((token) => token.text).join("");
  return {
    name: segment[variableIndex].text.slice(1),
    line: segment[variableIndex].line,
    by_reference: beforeVariable.includes("&"),
    variadic: beforeVariable.includes("...") || segment.some((token) => token.id === "T_ELLIPSIS"),
    type: tokenText(segment, 0, variableIndex).replace(/[&.]+$/g, "").trim() || null,
    has_default: equalIndex !== -1,
    default: equalIndex === -1 ? null : tokenText(segment, equalIndex + 1, segment.length)
  };
}

function parseParameters(tokens, openIndex, closeIndex) {
  const params = splitParamSegments(tokens.slice(openIndex + 1, closeIndex)).map(parseParameter).filter(Boolean);
  return params.map((param, index) => ({
    position: index,
    ...param
  }));
}

function collectFunctionCalls(tokens) {
  const calls = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = nextSignificant(tokens, index);
    if (next === -1 || tokens[next].text !== "(") continue;
    if (token.id !== "T_STRING" && token.id !== "T_ECHO" && token.id !== "T_PRINT") continue;
    const previous = previousSignificant(tokens, index);
    if (previous !== -1 && ["T_FUNCTION", "T_NEW", "T_OBJECT_OPERATOR", "T_DOUBLE_COLON"].includes(tokens[previous].id)) continue;
    calls.push({ name: token.id === "T_STRING" ? token.text : token.id === "T_ECHO" ? "echo" : "print", line: token.line });
  }
  return calls;
}

function collectStaticCalls(tokens) {
  const calls = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].id !== "T_DOUBLE_COLON") continue;
    const left = previousSignificant(tokens, index);
    const right = nextSignificant(tokens, index);
    if (left === -1 || right === -1) continue;
    const afterRight = nextSignificant(tokens, right);
    if (afterRight === -1 || tokens[afterRight].text !== "(") continue;
    calls.push({
      class: tokens[left].text,
      method: tokens[right].text,
      line: tokens[right].line
    });
  }
  return calls;
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).length > 0))].sort();
}

function callNames(records) {
  return uniqueSorted(records.map((record) => record.name));
}

function globalVariables(tokens) {
  const variables = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].id !== "T_GLOBAL") continue;
    for (let current = index + 1; current < tokens.length && tokens[current].text !== ";"; current += 1) {
      if (tokens[current].id === "T_VARIABLE") variables.push(tokens[current].text);
    }
  }
  return uniqueSorted(variables);
}

function methodSummary(tokens, source) {
  const functions = collectFunctionCalls(tokens);
  const staticCalls = collectStaticCalls(tokens);
  const functionNames = callNames(functions);
  const sourceText = tokens.map((token) => token.text).join("");
  return {
    function_calls: functionNames,
    static_calls: staticCalls.map((call) => `${call.class}::${call.method}`).sort(),
    hook_functions: functionNames.filter((name) => HOOK_FUNCTIONS.has(name)).sort(),
    callback_functions: functionNames.filter((name) => CALLBACK_FUNCTIONS.has(name)).sort(),
    network_functions: functionNames.filter((name) => NETWORK_FUNCTIONS.has(name)).sort(),
    warning_functions: functionNames.filter((name) => WARNING_FUNCTIONS.has(name)).sort(),
    include_tokens: uniqueSorted(tokens.filter((token) => INCLUDE_TOKENS.has(token.id)).map((token) => token.id)),
    global_variables: globalVariables(tokens),
    superglobals: uniqueSorted([...sourceText.matchAll(/\$_(?:GET|POST|SERVER|REQUEST|COOKIE|FILES|SESSION)\b|\$GLOBALS\b/g)].map((match) => match[0])),
    has_try_catch_throw: tokens.some((token) => ["T_TRY", "T_CATCH", "T_THROW"].includes(token.id)),
    has_static_local: tokens.some((token) => token.id === "T_STATIC"),
    has_reference_mutation: /&\s*\$|\[\s*&\s*\$/.test(sourceText),
    has_output_segment: tokens.some((token) => token.id === "T_INLINE_HTML" || token.id === "T_CLOSE_TAG"),
    has_echo_or_print: tokens.some((token) => token.id === "T_ECHO" || token.id === "T_PRINT"),
    has_variable_method_or_property: /\$[A-Za-z_][A-Za-z0-9_]*\s*->\s*\$|\$[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(sourceText),
    line_span: {
      start: tokens.find((token) => token.line !== null)?.line ?? null,
      end: tokens.filter((token) => token.line !== null).at(-1)?.line ?? null
    }
  };
}

function parseClass(tokens, classIndex) {
  const nameIndex = nextSignificant(tokens, classIndex);
  const name = nameIndex === -1 ? null : tokens[nameIndex].text;
  let bodyStart = nameIndex;
  while (bodyStart < tokens.length && tokens[bodyStart].text !== "{") bodyStart += 1;
  const bodyEnd = findMatching(tokens, bodyStart, "{", "}");
  const bodyTokens = tokens.slice(bodyStart + 1, bodyEnd);
  const classSource = tokens.slice(classIndex, bodyEnd + 1).map((token) => token.text).join("");
  const constants = [];
  const properties = [];
  const methods = [];

  let depth = 1;
  for (let index = bodyStart + 1; index < bodyEnd; index += 1) {
    const token = tokens[index];
    if (token.text === "{") {
      depth += 1;
      continue;
    }
    if (token.text === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1) continue;

    if (token.id === "T_CONST") {
      const modifiers = modifiersBefore(tokens, index);
      const statementEnd = tokens.findIndex((candidate, offset) => offset > index && candidate.text === ";");
      const names = [];
      for (let current = index + 1; current < statementEnd; current += 1) {
        if (tokens[current].id === "T_STRING") names.push({ name: tokens[current].text, line: tokens[current].line });
      }
      for (const record of names) {
        constants.push({
          ...record,
          visibility: visibilityFromModifiers(modifiers)
        });
      }
      index = statementEnd;
      continue;
    }

    if (token.id === "T_VARIABLE") {
      const modifiers = modifiersBefore(tokens, index);
      const statementEnd = tokens.findIndex((candidate, offset) => offset > index && candidate.text === ";");
      const equalIndex = tokens.findIndex((candidate, offset) => offset > index && offset < statementEnd && candidate.text === "=");
      properties.push({
        name: token.text.slice(1),
        line: token.line,
        visibility: visibilityFromModifiers(modifiers),
        static: modifiers.includes("T_STATIC"),
        has_default: equalIndex !== -1,
        default: equalIndex === -1 ? null : tokenText(tokens, equalIndex + 1, statementEnd)
      });
      index = statementEnd;
      continue;
    }

    if (token.id === "T_FUNCTION") {
      const modifiers = modifiersBefore(tokens, index);
      let current = nextSignificant(tokens, index);
      const returnsByReference = current !== -1 && tokens[current].text === "&";
      if (returnsByReference) current = nextSignificant(tokens, current);
      const nameToken = tokens[current];
      let paramsOpen = current;
      while (paramsOpen < tokens.length && tokens[paramsOpen].text !== "(") paramsOpen += 1;
      const paramsClose = findMatching(tokens, paramsOpen, "(", ")");
      let methodBodyStart = paramsClose;
      while (methodBodyStart < tokens.length && tokens[methodBodyStart].text !== "{" && tokens[methodBodyStart].text !== ";") methodBodyStart += 1;
      const methodBodyEnd = tokens[methodBodyStart].text === "{" ? findMatching(tokens, methodBodyStart, "{", "}") : methodBodyStart;
      const body = tokens[methodBodyStart].text === "{" ? tokens.slice(methodBodyStart + 1, methodBodyEnd) : [];
      const parameters = parseParameters(tokens, paramsOpen, paramsClose);
      methods.push({
        name: nameToken.text,
        line: nameToken.line,
        visibility: visibilityFromModifiers(modifiers),
        static: modifiers.includes("T_STATIC"),
        returns_by_reference: returnsByReference,
        parameter_count: parameters.length,
        required_parameter_count: parameters.filter((param) => !param.has_default && !param.variadic).length,
        parameters,
        body_summary: methodSummary(body)
      });
      index = methodBodyEnd;
    }
  }

  return {
    name,
    line: tokens[classIndex].line,
    allow_dynamic_properties: classSource.includes("#[AllowDynamicProperties]"),
    body_range: { start_token: bodyStart, end_token: bodyEnd },
    constants,
    properties,
    methods,
    summary: {
      constant_count: constants.length,
      property_count: properties.length,
      method_count: methods.length,
      public_method_count: methods.filter((method) => method.visibility === "public").length,
      protected_method_count: methods.filter((method) => method.visibility === "protected").length,
      private_method_count: methods.filter((method) => method.visibility === "private").length,
      static_method_count: methods.filter((method) => method.static).length,
      methods_with_byref_params: methods.filter((method) => method.parameters.some((param) => param.by_reference)).map((method) => method.name).sort(),
      methods_with_output_segments: methods.filter((method) => method.body_summary.has_output_segment).map((method) => method.name).sort(),
      methods_with_global_variables: methods.filter((method) => method.body_summary.global_variables.length > 0).map((method) => method.name).sort(),
      methods_with_superglobals: methods.filter((method) => method.body_summary.superglobals.length > 0).map((method) => method.name).sort(),
      methods_with_dynamic_dispatch: methods.filter((method) => method.body_summary.callback_functions.length > 0 || method.body_summary.has_variable_method_or_property).map((method) => method.name).sort(),
      methods_with_try_catch_throw: methods.filter((method) => method.body_summary.has_try_catch_throw).map((method) => method.name).sort(),
      methods_with_static_state: methods.filter((method) => method.body_summary.has_static_local).map((method) => method.name).sort()
    }
  };
}

function classRanges(classes) {
  return classes.map((entry) => entry.body_range);
}

function inRanges(index, ranges) {
  return ranges.some((range) => index >= range.start_token && index <= range.end_token);
}

function parseTopLevel(tokens, classes, source) {
  const ranges = classRanges(classes);
  const topLevelTokens = tokens.filter((_, index) => !inRanges(index, ranges));
  const topLevelSource = topLevelTokens.map((token) => token.text).join("");
  const includes = topLevelTokens.filter((token) => INCLUDE_TOKENS.has(token.id)).map((token) => ({
    token: token.id,
    line: token.line
  }));
  const functions = collectFunctionCalls(topLevelTokens);
  return {
    guard_defined_abspath: /defined\s*\(\s*['"]ABSPATH['"]\s*\)/.test(topLevelSource),
    class_exists_checks: [...topLevelSource.matchAll(/class_exists\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]).sort(),
    include_or_require_count: includes.length,
    includes,
    function_calls: callNames(functions),
    static_calls: collectStaticCalls(topLevelTokens).map((call) => `${call.class}::${call.method}`).sort(),
    top_level_die_or_exit: /\b(?:die|exit)\s*\(/.test(topLevelSource),
    top_level_inline_html: topLevelTokens.some((token) => token.id === "T_INLINE_HTML"),
    line_count: source.split("\n").length
  };
}

function extractHookNames(source) {
  return uniqueSorted([...source.matchAll(/\b(?:add_action|add_filter|apply_filters|do_action|has_filter|remove_filter)\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]));
}

function surfacePressure(source, classes) {
  const allMethods = classes.flatMap((entry) => entry.methods);
  const allFunctionCalls = uniqueSorted(allMethods.flatMap((method) => method.body_summary.function_calls));
  const allHookFunctions = uniqueSorted(allMethods.flatMap((method) => method.body_summary.hook_functions));
  const allNetworkFunctions = uniqueSorted(allMethods.flatMap((method) => method.body_summary.network_functions));
  const allWarningFunctions = uniqueSorted(allMethods.flatMap((method) => method.body_summary.warning_functions));
  return {
    hook_names: extractHookNames(source),
    hook_functions: allHookFunctions,
    callback_functions: uniqueSorted(allMethods.flatMap((method) => method.body_summary.callback_functions)),
    network_functions: allNetworkFunctions,
    warning_functions: allWarningFunctions,
    superglobals: uniqueSorted(allMethods.flatMap((method) => method.body_summary.superglobals)),
    global_variables: uniqueSorted(allMethods.flatMap((method) => method.body_summary.global_variables)),
    includes_or_requires_inside_methods: uniqueSorted(allMethods.flatMap((method) => method.body_summary.include_tokens)),
    has_mixed_php_html: allMethods.some((method) => method.body_summary.has_output_segment),
    has_requests_integration: /WpOrg\\Requests|Requests::|Requests\\/.test(source),
    has_wp_query: allFunctionCalls.includes("WP_Query") || /\bnew\s+WP_Query\b/.test(source),
    has_remote_fetch_or_discovery: allNetworkFunctions.length > 0 || /\bdiscover\s*\(|\bfetch\s*\(|wp_safe_remote_get|wp_remote_get/.test(source),
    has_json_or_xml_parsing: /\bjson_decode\b|\bsimplexml_load_string\b|\bDOMDocument\b|\bxml_parse\b/.test(source),
    has_dynamic_dispatch: allMethods.some((method) => method.body_summary.callback_functions.length > 0 || method.body_summary.has_variable_method_or_property),
    has_references: allMethods.some((method) => method.body_summary.has_reference_mutation || method.parameters.some((param) => param.by_reference)),
    has_try_catch_throw: allMethods.some((method) => method.body_summary.has_try_catch_throw),
    function_call_count: allFunctionCalls.length
  };
}

function sourceInventory(file) {
  const source = readFileSync(file.source_path, "utf8");
  const tokens = tokenize(file.source_path);
  const classes = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].id !== "T_CLASS") continue;
    const previous = previousSignificant(tokens, index);
    if (previous !== -1 && tokens[previous].id === "T_DOUBLE_COLON") continue;
    classes.push(parseClass(tokens, index));
  }
  const targetClass = classes.find((entry) => entry.name === file.expected_class);
  const targetMethodNames = new Set(targetClass?.methods.map((method) => method.name) ?? []);
  const currentEvidence = file.current_evidence.map((entry) => ({
    ...entry,
    manifest_sha256: existsSync(entry.manifest) ? sha256File(entry.manifest) : null,
    claimed_symbols_in_source: entry.claimed_symbols.every((symbol) => targetMethodNames.has(symbol)),
    missing_claimed_symbols: entry.claimed_symbols.filter((symbol) => !targetMethodNames.has(symbol))
  }));
  return {
    key: file.key,
    original_path: file.original_path,
    source: fileRecord(file.source_path),
    expected_class: file.expected_class,
    classes: classes.map(({ body_range, ...entry }) => entry),
    top_level: parseTopLevel(tokens, classes, source),
    surface_pressure: surfacePressure(source, classes),
    current_generated_evidence: currentEvidence,
    whole_file_ownership_gate: {
      generic_items: [
        "complete source-surface inventory of declarations, properties, constants, attributes, guards, includes, top-level effects, globals, static state, references, defaults, visibility, callbacks, and dynamic dispatch",
        "WPHX-generated original-path file with unsupported=[], deterministic snapshots, no copied shell body, no runner patching, and no stock public-shape fallback",
        "reflection/ABI checks for every public/protected/private method, property, constant, default, by-reference parameter, variadic, attribute, and dynamic-property contract observable by plugins or themes",
        "oracle/candidate behavior probes covering success, false/null/empty, warning/deprecation, exception, repeated include, static-state, filter/action payload, native-array, object identity, and callback branches",
        "packaged installed-style gates, selected upstream PHPUnit pass/pass ratchets, plugin/theme reflection and stack-trace gates, source-map/debug review, and generated-PHP readability review"
      ],
      file_specific_items: file.file_specific_gate_items
    },
    ownership_state: "selected_boundaries_only",
    current_non_claim: file.current_non_claim,
    full_file_owned: false
  };
}

function gitInfo(path) {
  return {
    path,
    commit: run("git", ["-C", path, "rev-parse", "HEAD"]).trim(),
    dirty: run("git", ["-C", path, "status", "--short"]).trim()
  };
}

function validate(inventories) {
  const failures = [];
  for (const inventory of inventories) {
    const targetClass = inventory.classes.find((entry) => entry.name === inventory.expected_class);
    if (!targetClass) failures.push(`${inventory.original_path} missing expected class ${inventory.expected_class}`);
    if (targetClass && targetClass.summary.method_count === 0) failures.push(`${inventory.original_path} has no parsed methods`);
    if (targetClass && targetClass.summary.property_count === 0 && inventory.expected_class !== "WP_Http") {
      failures.push(`${inventory.original_path} has no parsed properties`);
    }
    if (inventory.whole_file_ownership_gate.generic_items.length < 5) failures.push(`${inventory.original_path} generic gate is incomplete`);
    if (inventory.whole_file_ownership_gate.file_specific_items.length < 5) failures.push(`${inventory.original_path} file-specific gate is incomplete`);
    if (inventory.full_file_owned !== false) failures.push(`${inventory.original_path} must not be marked full-file owned`);
    for (const evidence of inventory.current_generated_evidence) {
      if (!evidence.claimed_symbols_in_source) {
        failures.push(`${inventory.original_path} claimed symbols missing from source: ${evidence.missing_claimed_symbols.join(", ")}`);
      }
      if (evidence.manifest_sha256 === null) failures.push(`${inventory.original_path} evidence manifest is missing: ${evidence.manifest}`);
    }
  }
  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    inventory_count: inventories.length,
    expected_file_count: FILES.length,
    all_expected_classes_found: failures.every((failure) => !failure.includes("missing expected class")),
    all_current_claimed_symbols_exist_in_source: failures.every((failure) => !failure.includes("claimed symbols missing")),
    all_files_have_whole_file_gate_checklists: inventories.every(
      (inventory) => inventory.whole_file_ownership_gate.generic_items.length >= 5 && inventory.whole_file_ownership_gate.file_specific_items.length >= 5
    ),
    no_full_file_ownership_claims: inventories.every((inventory) => inventory.full_file_owned === false)
  };
}

function main() {
  const inventories = FILES.map(sourceInventory);
  const validationResult = validate(inventories);
  if (validationResult.status !== "passed") {
    throw new Error(`file ownership inventory validation failed: ${JSON.stringify(validationResult.failures, null, 2)}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-file-ownership-inventories.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "whole_file_ownership_inventory_gate",
    artifact_scope: "source_surface_inventory_for_class_wp_http_embed_oembed_before_full_file_claims",
    oracle_checkout: {
      ...gitInfo(WORDPRESS_ROOT),
      authority: "WordPress 7.0 source and behavior oracle",
      upstream_lock: "upstream.lock.json"
    },
    inventories,
    summary: {
      file_count: inventories.length,
      class_count: inventories.reduce((sum, inventory) => sum + inventory.classes.length, 0),
      method_count: inventories.reduce((sum, inventory) => sum + inventory.classes.reduce((classSum, entry) => classSum + entry.summary.method_count, 0), 0),
      property_count: inventories.reduce((sum, inventory) => sum + inventory.classes.reduce((classSum, entry) => classSum + entry.summary.property_count, 0), 0),
      files_with_mixed_php_html: inventories.filter((inventory) => inventory.surface_pressure.has_mixed_php_html).map((inventory) => inventory.original_path),
      files_with_requests_integration: inventories.filter((inventory) => inventory.surface_pressure.has_requests_integration).map((inventory) => inventory.original_path),
      files_with_remote_fetch_or_discovery: inventories.filter((inventory) => inventory.surface_pressure.has_remote_fetch_or_discovery).map((inventory) => inventory.original_path),
      files_with_json_or_xml_parsing: inventories.filter((inventory) => inventory.surface_pressure.has_json_or_xml_parsing).map((inventory) => inventory.original_path),
      files_with_dynamic_dispatch: inventories.filter((inventory) => inventory.surface_pressure.has_dynamic_dispatch).map((inventory) => inventory.original_path),
      files_with_references: inventories.filter((inventory) => inventory.surface_pressure.has_references).map((inventory) => inventory.original_path),
      files_with_superglobals: inventories.filter((inventory) => inventory.surface_pressure.superglobals.length > 0).map((inventory) => inventory.original_path)
    },
    validation_result: validationResult,
    claims: [
      "The three HTTP/embed/oEmbed class files now have source-derived inventories and whole-file ownership gate checklists.",
      "Current generated WPHX PHP evidence for these files is classified as selected-boundary evidence, not full-file ownership.",
      "Future class-wp-http.php, class-wp-embed.php, and class-wp-oembed.php method additions should cite the relevant inventory before broadening ownership claims."
    ],
    non_claims: [
      "This manifest does not claim full class-wp-http.php, class-wp-embed.php, or class-wp-oembed.php ownership.",
      "This manifest does not claim installed WordPress distribution behavior, live HTTP/oEmbed transport ownership, full WP_Embed editor/admin behavior, or complete upstream PHPUnit parity.",
      "This manifest does not reduce the need for plugin/theme reflection, packaged stack-trace/source-map, readability, and installed/package gates before broad public distribution claims."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-file-ownership-inventories",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    command: "npm run wphx:php:file-ownership-inventories",
    check_command: "npm run wphx:php:file-ownership-inventories:check",
    artifacts: [
      { path: RUNNER, role: "deterministic source-surface inventory runner" },
      { path: MANIFEST, role: "file ownership inventory manifest" },
      { path: "docs/operations/wphx-php-compiler.md", role: "compiler operations documentation updated with inventory gate" },
      { path: "docs/operations/progress-matrix.md", role: "program progress matrix updated with inventory gate" }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        files: inventories.map((inventory) => inventory.original_path),
        method_count: manifest.summary.method_count,
        full_file_owned: false
      },
      null,
      2
    )
  );
}

main();
