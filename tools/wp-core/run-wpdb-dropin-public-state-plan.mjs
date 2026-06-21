#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import phpParser from "php-parser";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.22",
  external_ref: "WPHX-305.22",
  title: "Prove wpdb drop-in/public state ownership boundary"
};
const OUT = "manifests/wp-core/wphx-305-22-wpdb-dropin-public-state-plan.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-305-22-wpdb-dropin-public-state-plan.v1.json";
const RECEIPT = "receipts/wp-core/wphx-305-22-wpdb-dropin-public-state-plan.v1.json";
const WPDB_SURFACE = "manifests/wp-core/wphx-305-01-wpdb-surface.v1.json";
const MYSQLI_PHPGLOBAL_CANDIDATE = "manifests/wp-core/wphx-305-20-wpdb-mysqli-phpglobal-candidate.v1.json";
const ROW_MATERIALIZATION_CANDIDATE = "manifests/wp-core/wphx-305-21-wpdb-row-materialization-candidate.v1.json";
const RECORDED_AT = "2026-06-21T06:55:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wpdb.php",
  "src/wp-includes/load.php",
  "src/wp-includes/wp-db.php",
  "src/wp-settings.php",
  "src/wp-admin/install.php",
  "src/wp-admin/setup-config.php",
  "src/wp-admin/includes/plugin.php",
  "src/wp-admin/includes/update-core.php",
  "src/wp-admin/update-core.php",
  "src/wp-admin/upgrade.php"
];

const PUBLIC_QUERY_STATE = new Set([
  "show_errors",
  "suppress_errors",
  "last_error",
  "num_queries",
  "num_rows",
  "rows_affected",
  "insert_id",
  "last_query",
  "last_result",
  "queries",
  "func_call",
  "time_start",
  "error"
]);

const PUBLIC_TABLE_STATE = new Set([
  "prefix",
  "base_prefix",
  "blogid",
  "siteid",
  "tables",
  "old_tables",
  "global_tables",
  "ms_global_tables",
  "old_ms_global_tables",
  "comments",
  "commentmeta",
  "links",
  "options",
  "postmeta",
  "posts",
  "terms",
  "term_relationships",
  "term_taxonomy",
  "termmeta",
  "usermeta",
  "users",
  "blogs",
  "blogmeta",
  "registration_log",
  "signups",
  "site",
  "sitecategories",
  "sitemeta"
]);

const PUBLIC_BOOTSTRAP_STATE = new Set(["ready", "field_types", "charset", "collate", "is_mysql"]);
const MAGIC_SET_BLOCKED = ["col_meta", "table_charset", "check_current_query", "allow_unsafe_unquoted_parameters"];

const parser = new phpParser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
    suppressErrors: true
  },
  ast: {
    withPositions: true,
    withSource: true
  }
});

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

function compareText(a, b) {
  return String(a).localeCompare(String(b));
}

function identifierName(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.name === "string") return value.name;
  return value.loc?.source ?? null;
}

function sourceOf(node) {
  return node?.loc?.source ?? null;
}

function locOf(node) {
  if (!node?.loc) return null;
  return {
    line: node.loc.start.line,
    column: node.loc.start.column,
    offset: node.loc.start.offset
  };
}

function docText(node) {
  return node?.leadingComments?.map((comment) => comment.value).join("\n") ?? "";
}

function docTag(doc, tag) {
  const match = doc.match(new RegExp(`@${tag}\\s+([^\\n*]+)`));
  return match ? match[1].trim() : null;
}

function propertyCategory(name, visibility) {
  if (visibility !== "public") return "magic_visible_internal_state";
  if (PUBLIC_QUERY_STATE.has(name)) return "query_result_error_state";
  if (PUBLIC_TABLE_STATE.has(name)) return "table_prefix_and_table_name_state";
  if (PUBLIC_BOOTSTRAP_STATE.has(name)) return "bootstrap_capability_state";
  return "public_extension_or_legacy_state";
}

function propertyMutationPolicy(name, visibility) {
  if (visibility === "public") return "direct_public_read_write";
  if (MAGIC_SET_BLOCKED.includes(name)) return "magic_readable_write_blocked_by_wpdb___set";
  if (name === "col_info") return "magic_readable_lazy_load_on___get";
  return "magic_read_write_unset_backward_compat";
}

function defaultKind(property) {
  if (!property.value) return "implicit_null";
  return property.value.kind ?? "unknown";
}

function wpdbClassSurface() {
  const path = "src/wp-includes/class-wpdb.php";
  const source = readFileSync(upstreamPath(path), "utf8");
  const ast = parser.parseCode(source, path);
  const errors = (ast.errors ?? []).map((error) => error.message);
  const wpdbClass = ast.children.find((node) => node.kind === "class" && identifierName(node.name) === "wpdb");
  if (!wpdbClass) throw new Error("Could not find wpdb class in upstream class-wpdb.php");

  const properties = [];
  const methods = [];
  for (const member of wpdbClass.body ?? []) {
    if (member.kind === "propertystatement") {
      const visibility = member.visibility ?? "public";
      const doc = docText(member);
      for (const property of member.properties ?? []) {
        const name = identifierName(property.name);
        properties.push({
          name,
          symbol: `wpdb::$${name}`,
          visibility,
          static: member.isStatic === true,
          location: locOf(property),
          since: docTag(doc, "since"),
          var_type: docTag(doc, "var"),
          default_source: sourceOf(property.value),
          default_kind: defaultKind(property),
          category: propertyCategory(name, visibility),
          mutation_policy: propertyMutationPolicy(name, visibility),
          shell_contract: visibility === "public" ? "must remain declared PHP property" : "must remain reachable through wpdb magic accessors"
        });
      }
    }
    if (member.kind === "method") {
      const name = identifierName(member.name);
      methods.push({
        name,
        symbol: `wpdb::${name}`,
        visibility: member.visibility ?? "public",
        static: member.isStatic === true,
        location: locOf(member),
        since: docTag(docText(member), "since"),
        parameters: (member.arguments ?? []).map((param, index) => ({
          index,
          name: identifierName(param.name),
          by_reference: param.byref === true,
          variadic: param.variadic === true,
          default_source: sourceOf(param.value)
        }))
      });
    }
  }

  const publicProperties = properties.filter((property) => property.visibility === "public");
  const internalProperties = properties.filter((property) => property.visibility !== "public");
  const publicMethods = methods.filter((method) => method.visibility === "public");
  return {
    parser: {
      package: "php-parser",
      errors
    },
    class: {
      name: "wpdb",
      location: locOf(wpdbClass),
      allow_dynamic_properties: source.includes("#[AllowDynamicProperties]"),
      doc_declares_db_dropin_replacement: source.includes("wp-content/db.php")
    },
    property_counts: {
      total: properties.length,
      public: publicProperties.length,
      magic_visible_internal: internalProperties.length
    },
    method_counts: {
      total: methods.length,
      public: publicMethods.length
    },
    public_properties: publicProperties.sort((a, b) => compareText(a.name, b.name)),
    magic_visible_internal_properties: internalProperties.sort((a, b) => compareText(a.name, b.name)),
    public_magic_methods: publicMethods
      .filter((method) => ["__get", "__set", "__isset", "__unset"].includes(method.name))
      .sort((a, b) => compareText(a.name, b.name)),
    public_constructor: publicMethods.find((method) => method.name === "__construct") ?? null
  };
}

function linesWithNeedles(path, needles) {
  const source = readFileSync(upstreamPath(path), "utf8");
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trimEnd() }))
    .filter((entry) => needles.some((needle) => entry.text.includes(needle)));
}

function bootstrapEvidence() {
  return {
    sequence: [
      {
        order: 1,
        path: "src/wp-settings.php",
        action: "global $wpdb is declared and require_wp_db() is called during bootstrap",
        invariant: "distribution must keep this call path PHP-visible before most plugin/theme code observes $wpdb"
      },
      {
        order: 2,
        path: "src/wp-includes/load.php",
        action: "require_wp_db() includes wp-includes/class-wpdb.php",
        invariant: "class wpdb must remain loadable even when a db.php drop-in supplies the global object"
      },
      {
        order: 3,
        path: "src/wp-includes/load.php",
        action: "require_wp_db() includes wp-content/db.php when present",
        invariant: "drop-ins can set global $wpdb to a replacement class before core instantiates wpdb"
      },
      {
        order: 4,
        path: "src/wp-includes/load.php",
        action: "require_wp_db() returns early when $wpdb is already set",
        invariant: "Haxe distribution must not eagerly overwrite a drop-in replacement"
      },
      {
        order: 5,
        path: "src/wp-includes/load.php",
        action: "require_wp_db() instantiates new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST)",
        invariant: "default construction remains the core-owned fallback when no db.php replacement exists"
      },
      {
        order: 6,
        path: "src/wp-includes/load.php",
        action: "wp_set_wpdb_vars() mutates $wpdb->field_types and calls $wpdb->set_prefix($table_prefix)",
        invariant: "public field_types/table-prefix mutation must stay compatible with direct property assignment"
      }
    ],
    source_lines: {
      wp_settings: linesWithNeedles("src/wp-settings.php", ["global $wpdb", "require_wp_db();"]),
      load_require_wp_db: linesWithNeedles("src/wp-includes/load.php", ["function require_wp_db", "class-wpdb.php", "db.php", "isset( $wpdb )", "new wpdb"]),
      load_set_wpdb_vars: linesWithNeedles("src/wp-includes/load.php", ["function wp_set_wpdb_vars", "$wpdb->field_types", "$wpdb->set_prefix"]),
      admin_db_dropin_checks: [
        ...linesWithNeedles("src/wp-admin/install.php", ["db.php", "$wpdb->base_prefix"]),
        ...linesWithNeedles("src/wp-admin/update-core.php", ["db.php", "$wpdb->is_mysql"]),
        ...linesWithNeedles("src/wp-admin/upgrade.php", ["db.php", "$wpdb->is_mysql"]),
        ...linesWithNeedles("src/wp-admin/includes/update-core.php", ["db.php", "$wpdb->is_mysql"]),
        ...linesWithNeedles("src/wp-admin/includes/plugin.php", ["db.php"])
      ]
    }
  };
}

function selectedSlice(publicState) {
  return {
    id: "typed-wpdb-public-state-descriptor-and-shell-contract",
    target_issue: "WPHX-305.23",
    selected_because:
      "WPHX-305.21 moved row materialization into typed Haxe, but the next risk is not another SQL branch: it is preserving the wpdb class as a PHP ABI object while Haxe starts owning state defaults and mutation policy. The minimal safe implementation slice is a typed Haxe descriptor plus PHP shell adapter proof, leaving require_wp_db()/db.php replacement timing untouched.",
    must_preserve: [
      "class name wpdb and global $wpdb bootstrap semantics",
      "#[AllowDynamicProperties] behavior for plugin-added fields",
      "declared public property names and direct assignment/read behavior",
      "__get/__set/__isset/__unset magic access for protected/private backward compatibility",
      "db.php drop-in early-return behavior in require_wp_db()",
      "wp_set_wpdb_vars() direct field_types assignment and set_prefix() call",
      "WPHX-305.21 row materialization and WPHX-305.20 mysqli @:phpGlobal execution gates"
    ],
    implementation_sketch: [
      "Add typed Haxe WpdbPublicStateDescriptor constants for declared public properties, magic-visible internals, default-value policy, and protected write-block names.",
      "Generate a PHP-visible wpdb shell check that verifies declared public properties, AllowDynamicProperties, and magic methods remain reflection-compatible with WordPress 7.0.",
      "Keep constructor, require_wp_db(), db.php inclusion, and global $wpdb replacement in PHP-visible shell code until the descriptor proof passes under bootstrap/drop-in probes.",
      "Only after that proof should individual state fields move to Haxe-owned storage helpers behind the shell."
    ],
    not_selected_yet: [
      {
        option: "replace require_wp_db() with generated Haxe bootstrap",
        reason: "Too much load-order and drop-in risk before a property/magic/dynamic contract receipt exists."
      },
      {
        option: "move all wpdb properties into typed Haxe storage immediately",
        reason: "Plugins can read/write declared public properties and add dynamic ones; moving storage first would risk reflection and mutation regressions."
      },
      {
        option: "custom PHP target for full wpdb class emission",
        reason: "May still become useful, but WPHX-305.22 shows the next blocker is ABI contract proof, not target lowering."
      }
    ],
    scope_boundaries: {
      public_property_count: publicState.property_counts.public,
      magic_visible_internal_property_count: publicState.property_counts.magic_visible_internal,
      magic_methods: publicState.public_magic_methods.map((method) => method.symbol),
      dynamic_properties_required: publicState.class.allow_dynamic_properties
    }
  };
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wpdb-dropin-public-state-plan",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "design-receipt",
      name: "wpdb drop-in and public-state ownership boundary plan",
      area: "wp-includes/wp-admin",
      public_contract:
        "WordPress-compatible wpdb remains a PHP-visible class and global object with declared public properties, dynamic property allowance, magic accessors, and db.php replacement timing intact while the next Haxe slice starts with a typed public-state descriptor and shell contract proof."
    },
    ownership_state: "haxe_port_plan",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-wpdb-dropin-public-state-plan.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    bridge: {
      kind: "public_php_abi_shell",
      reason:
        "The wpdb class is both a core database abstraction and a plugin/drop-in ABI object. WPHX-305.22 keeps the PHP-visible shell and db.php replacement seam authoritative while defining the minimal typed Haxe descriptor slice needed before public mutable state can move behind that shell.",
      bounded_by: [
        "upstream wpdb class AST property/method inventory",
        "require_wp_db() db.php early-return sequence",
        "WPHX-305.21 row materialization live candidate receipt",
        "WPHX-305.20 mysqli @:phpGlobal live candidate receipt",
        "future WPHX-305.23 typed public-state descriptor candidate"
      ]
    },
    removal_gate: {
      condition:
        "Do not replace require_wp_db(), class wpdb declaration shape, or global $wpdb instantiation until a typed descriptor/shell proof preserves declared public fields, magic-visible internal state, dynamic properties, db.php replacement, and live WPHX-305 database gates.",
      owner_issue: "WPHX-305.23",
      target_state: "verified_haxe_owned_public_state_shell"
    },
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-305-dropin-public-state-plan",
        "npm run wp:core:wphx-305-dropin-public-state-plan:check",
        "npm run wp:core:wphx-305-row-materialization-candidate:check",
        "npm run wp:core:wphx-305-mysqli-phpglobal-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: [
        "receipt:wphx-305-22-wpdb-dropin-public-state-plan",
        "receipt:wphx-305-21-wpdb-row-materialization-candidate",
        "receipt:wphx-305-20-wpdb-mysqli-phpglobal-candidate"
      ],
      manifest_digest: manifestSha
    }
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-305-dropin-public-state-plan`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const wpdbSurface = readJson(WPDB_SURFACE);
const mysqliPhpGlobalCandidate = readJson(MYSQLI_PHPGLOBAL_CANDIDATE);
const rowMaterializationCandidate = readJson(ROW_MATERIALIZATION_CANDIDATE);
const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const publicState = wpdbClassSurface();
const bootstrap = bootstrapEvidence();
const plan = selectedSlice(publicState);

const validationStatus =
  publicState.parser.errors.length === 0 &&
  publicState.class.name === "wpdb" &&
  publicState.class.allow_dynamic_properties === true &&
  publicState.class.doc_declares_db_dropin_replacement === true &&
  publicState.property_counts.public > 0 &&
  publicState.public_magic_methods.length === 4 &&
  bootstrap.sequence.length === 6 &&
  mysqliPhpGlobalCandidate.validation_result?.status === "passed" &&
  rowMaterializationCandidate.validation_result?.status === "passed"
    ? "passed"
    : "failed";

const manifest = {
  schema: "wphx.wp-core-wpdb-dropin-public-state-plan.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-wpdb-dropin-public-state-plan.mjs",
  inputs: {
    wpdb_surface_manifest: inputRecord(WPDB_SURFACE),
    mysqli_phpglobal_candidate_manifest: inputRecord(MYSQLI_PHPGLOBAL_CANDIDATE),
    row_materialization_candidate_manifest: inputRecord(ROW_MATERIALIZATION_CANDIDATE),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "design_receipt",
    source_domains: wpdbSurface.domains
      .filter((domain) => ["wpdb_public_state", "bootstrap_connection", "query_execution_results"].includes(domain.id))
      .map((domain) => domain.label),
    public_state: publicState,
    bootstrap_dropin_boundary: bootstrap,
    selected_next_slice: plan,
    inherited_mysqli_phpglobal_candidate: {
      manifest: MYSQLI_PHPGLOBAL_CANDIDATE,
      validation_result: mysqliPhpGlobalCandidate.validation_result
    },
    inherited_row_materialization_candidate: {
      manifest: ROW_MATERIALIZATION_CANDIDATE,
      validation_result: rowMaterializationCandidate.validation_result
    },
    public_abi_policy: {
      preserve_class_name_wpdb: true,
      preserve_global_wpdb: true,
      preserve_db_php_dropin_replacement: true,
      preserve_declared_public_properties: true,
      preserve_magic_accessors: true,
      preserve_dynamic_properties: true,
      raw_php_syntax_code_used_in_haxe: false,
      generated_php_postprocessing_required: false
    },
    closes_gaps_from: [
      {
        manifest: ROW_MATERIALIZATION_CANDIDATE,
        gap: "full-wpdb-drop-in-and-public-state-ownership-not-yet-proven",
        resolution:
          "WPHX-305.22 proves the next ownership boundary as a design receipt: first add a typed public-state descriptor and PHP shell contract proof, preserving db.php replacement timing and PHP-visible wpdb properties before moving individual state storage into Haxe."
      }
    ],
    remaining_gaps: [
      {
        id: "typed-public-state-descriptor-not-yet-implemented",
        owner: "WPHX-305.23",
        detail:
          "This receipt selects the next implementation slice but does not yet add WpdbPublicStateDescriptor or a reflection/drop-in shell candidate."
      },
      {
        id: "require-wp-db-bootstrap-not-yet-haxe-owned",
        owner: "future WPHX-305 bootstrap distribution workset",
        detail:
          "require_wp_db(), db.php inclusion, and global $wpdb replacement remain PHP-visible WordPress shell behavior until the public-state descriptor proof is green."
      },
      {
        id: "full-upstream-phpunit-not-yet-ported",
        owner: "WPHX-305",
        detail:
          "Live database gates cover the current wpdb slices, but full upstream wpdb/dbDelta/option PHPUnit parity remains a domain closure requirement."
      }
    ]
  },
  validation_result: {
    status: validationStatus,
    selected_strategy: plan.id,
    public_property_count: publicState.property_counts.public,
    magic_visible_internal_property_count: publicState.property_counts.magic_visible_internal,
    magic_method_count: publicState.public_magic_methods.length,
    dynamic_properties_required: publicState.class.allow_dynamic_properties,
    db_dropin_replacement_required: publicState.class.doc_declares_db_dropin_replacement,
    predecessor_row_materialization_status: rowMaterializationCandidate.validation_result?.status ?? null,
    predecessor_mysqli_phpglobal_status: mysqliPhpGlobalCandidate.validation_result?.status ?? null
  }
};

if (validationStatus !== "passed") {
  console.error(JSON.stringify({ status: "failed", validation_result: manifest.validation_result, parser_errors: publicState.parser.errors }, null, 2));
  process.exit(1);
}

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-305-22-wpdb-dropin-public-state-plan",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "wpdb drop-in and public-state boundary plan manifest"
    },
    {
      path: OWNERSHIP,
      role: "Haxe port plan ownership manifest"
    },
    {
      path: "tools/wp-core/run-wpdb-dropin-public-state-plan.mjs",
      role: "wpdb drop-in/public-state boundary generator and check-mode validator"
    },
    {
      path: "src/wphx/wp/db/WpdbRowMaterialization.hx",
      role: "predecessor typed Haxe row materialization implementation kept green"
    },
    {
      path: "src/wphx/wp/db/WpdbMysqliExecution.hx",
      role: "predecessor typed Haxe mysqli @:phpGlobal execution implementation kept green"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-305-dropin-public-state-plan",
    "npm run wp:core:wphx-305-dropin-public-state-plan:check",
    "npm run wp:core:wphx-305-row-materialization-candidate:check",
    "npm run wp:core:wphx-305-mysqli-phpglobal-candidate:check",
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
      public_property_count: manifest.validation_result.public_property_count,
      magic_visible_internal_property_count: manifest.validation_result.magic_visible_internal_property_count,
      magic_method_count: manifest.validation_result.magic_method_count,
      dynamic_properties_required: manifest.validation_result.dynamic_properties_required,
      db_dropin_replacement_required: manifest.validation_result.db_dropin_replacement_required
    },
    null,
    2
  )
);
