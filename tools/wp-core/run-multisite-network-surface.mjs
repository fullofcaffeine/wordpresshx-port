#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-0d8",
  external_ref: "WPHX-317.01",
  title: "Inventory multisite and network surface"
};
const OUT = "manifests/wp-core/wphx-317-01-multisite-network-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-317-01-multisite-network-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-317-01-multisite-network-surface.v1.json";
const RECORDED_AT = "2026-06-22T21:27:54.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const TEST_INVENTORY = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const BASELINE = "wordpress-7.0.0";
const UPSTREAM_ROOT = "../wordpress-develop";

const PRIMARY_SOURCE_UNITS = [
  {
    path: "src/wp-includes/ms-blogs.php",
    category: "site_blog_switching",
    role: "Blog/site option compatibility wrappers, blog lookup, status updates, blog switching, site count, and cache switching behavior"
  },
  {
    path: "src/wp-includes/ms-site.php",
    category: "site_lifecycle_metadata",
    role: "WP_Site CRUD, site meta, site cache priming/invalidation, site lifecycle hooks, and site count updates"
  },
  {
    path: "src/wp-includes/ms-network.php",
    category: "network_lookup_cache",
    role: "Network lookup, network query facade, network cache priming, and network cache invalidation"
  },
  {
    path: "src/wp-includes/ms-load.php",
    category: "multisite_bootstrap_routing",
    role: "Current site/network bootstrap, path/domain routing, active network plugins, and multisite unavailable handling"
  },
  {
    path: "src/wp-includes/ms-settings.php",
    category: "multisite_bootstrap_routing",
    role: "Early multisite bootstrap script with global setup and include/load timing"
  },
  {
    path: "src/wp-includes/ms-functions.php",
    category: "network_lifecycle_signup_uploads",
    role: "Network/site/user creation, signup/activation, quotas, upload space, network counts, and notification helpers"
  },
  {
    path: "src/wp-includes/ms-default-filters.php",
    category: "multisite_hooks_defaults",
    role: "Default multisite filters/actions and bootstrap hook registration"
  },
  {
    path: "src/wp-includes/ms-default-constants.php",
    category: "multisite_constants",
    role: "Multisite upload, cookie, and file constant defaults"
  },
  {
    path: "src/wp-includes/ms-files.php",
    category: "multisite_file_serving",
    role: "Legacy multisite file serving boundary"
  },
  {
    path: "src/wp-includes/class-wp-site.php",
    category: "site_objects_queries",
    role: "WP_Site public class shape, magic accessors, details loading, and array conversion"
  },
  {
    path: "src/wp-includes/class-wp-site-query.php",
    category: "site_objects_queries",
    role: "WP_Site_Query public class shape, query vars, SQL assembly, meta/date query integration, and found-site behavior"
  },
  {
    path: "src/wp-includes/class-wp-network.php",
    category: "network_objects_queries",
    role: "WP_Network public class shape, magic accessors, path lookup, and main-site identity"
  },
  {
    path: "src/wp-includes/class-wp-network-query.php",
    category: "network_objects_queries",
    role: "WP_Network_Query public class shape, query vars, SQL assembly, and found-network behavior"
  },
  {
    path: "src/wp-includes/option.php",
    category: "site_network_options",
    role: "Site/network options, site transients, sitemeta-backed storage, cache priming, and network option compatibility"
  },
  {
    path: "src/wp-includes/cache.php",
    category: "multisite_cache",
    role: "Public object-cache API and blog-switching cache behavior used by multisite"
  },
  {
    path: "src/wp-includes/class-wp-object-cache.php",
    category: "multisite_cache",
    role: "Default object-cache groups, global groups, and switch_to_blog behavior"
  },
  {
    path: "src/wp-admin/includes/network.php",
    category: "network_admin_setup",
    role: "Network setup validation and generated configuration instructions"
  },
  {
    path: "src/wp-admin/includes/ms.php",
    category: "network_admin_runtime",
    role: "Network admin helpers for quotas, site/user deletion, editable roles, nav, upload checks, and admin notices"
  },
  {
    path: "src/wp-admin/includes/ms-admin-filters.php",
    category: "network_admin_runtime",
    role: "Network admin filter wiring and load-time behavior"
  },
  {
    path: "src/wp-admin/network.php",
    category: "network_admin_pages",
    role: "Network admin bootstrap router"
  },
  {
    path: "src/wp-admin/network/admin.php",
    category: "network_admin_pages",
    role: "Network admin page bootstrap and capability boundary"
  },
  {
    path: "src/wp-admin/network/sites.php",
    category: "network_admin_pages",
    role: "Network sites list page and list-table integration"
  },
  {
    path: "src/wp-admin/network/site-new.php",
    category: "network_admin_pages",
    role: "Network new-site page and site creation integration"
  },
  {
    path: "src/wp-admin/network/settings.php",
    category: "network_admin_pages",
    role: "Network settings page and network option form handling"
  },
  {
    path: "src/wp-admin/network/users.php",
    category: "network_admin_pages",
    role: "Network users page and user/site relationship administration"
  },
  {
    path: "src/wp-admin/network/upgrade.php",
    category: "network_admin_pages",
    role: "Network upgrade page and per-site upgrade dispatch"
  },
  {
    path: "src/wp-admin/ms-delete-site.php",
    category: "legacy_ms_admin_pages",
    role: "Legacy site deletion page and current-site deletion behavior"
  },
  {
    path: "src/wp-admin/ms-options.php",
    category: "legacy_ms_admin_pages",
    role: "Legacy multisite options page compatibility"
  },
  {
    path: "src/wp-admin/ms-sites.php",
    category: "legacy_ms_admin_pages",
    role: "Legacy multisite sites page compatibility"
  },
  {
    path: "src/wp-admin/ms-themes.php",
    category: "legacy_ms_admin_pages",
    role: "Legacy multisite themes page compatibility"
  },
  {
    path: "src/wp-admin/ms-users.php",
    category: "legacy_ms_admin_pages",
    role: "Legacy multisite users page compatibility"
  }
];

const DEFERRED_CROSS_DOMAIN_BEHAVIORS = [
  {
    id: "user-and-capability-interactions",
    deferred_to: "WPHX-306",
    source_paths: ["src/wp-includes/ms-functions.php", "src/wp-admin/includes/ms.php"],
    reason:
      "Multisite user creation, role changes, spam flags, and network admin permissions depend on auth/user/capability semantics outside this first inventory slice."
  },
  {
    id: "media-upload-and-filesystem-quota",
    deferred_to: "WPHX-309/WPHX-314",
    source_paths: ["src/wp-includes/ms-functions.php", "src/wp-includes/ms-files.php", "src/wp-admin/includes/ms.php"],
    reason:
      "Upload space and legacy file serving touch filesystem/media behavior; this slice records the boundary while later media/filesystem gates own parity."
  },
  {
    id: "object-cache-global-groups",
    deferred_to: "WPHX-304",
    source_paths: ["src/wp-includes/cache.php", "src/wp-includes/class-wp-object-cache.php"],
    reason:
      "Multisite depends on cache group scoping and blog switching, but the object-cache implementation remains owned by the WPHX-304 storage/cache slice."
  },
  {
    id: "wpdb-prefix-and-schema-effects",
    deferred_to: "WPHX-305",
    source_paths: ["src/wp-includes/ms-site.php", "src/wp-includes/ms-functions.php", "src/wp-includes/option.php"],
    reason:
      "Sitemeta, blog tables, base prefixes, and network/site creation require wpdb schema and prefix behavior from WPHX-305."
  },
  {
    id: "admin-ui-list-tables-and-screens",
    deferred_to: "WPHX-310/WPHX-600",
    source_paths: ["src/wp-admin/includes/ms.php", "src/wp-admin/network/sites.php", "src/wp-admin/network/users.php"],
    reason:
      "Network admin pages are PHP runtime surfaces now, but their complete UI/browser behavior crosses admin screens, list tables, scripts, and later browser work."
  }
];

const SITE_NETWORK_OPTION_SYMBOLS = [
  "wp_prime_site_option_caches",
  "wp_prime_network_option_caches",
  "wp_load_core_site_options",
  "get_site_option",
  "add_site_option",
  "delete_site_option",
  "update_site_option",
  "get_network_option",
  "add_network_option",
  "delete_network_option",
  "update_network_option"
];

const SITE_TRANSIENT_SYMBOLS = ["delete_expired_transients", "delete_site_transient", "get_site_transient", "set_site_transient"];

const SITE_BLOG_SWITCHING_SYMBOLS = [
  "add_blog_option",
  "clean_site_details_cache",
  "delete_blog_option",
  "get_blog_details",
  "get_blog_option",
  "get_blog_status",
  "get_blogaddress_by_id",
  "get_blogaddress_by_name",
  "get_id_from_blogname",
  "get_last_updated",
  "ms_is_switched",
  "refresh_blog_details",
  "restore_current_blog",
  "switch_to_blog",
  "update_blog_details",
  "update_blog_option",
  "update_blog_status",
  "wp_cache_switch_to_blog_fallback",
  "wp_count_sites"
];

const SITE_LIFECYCLE_SYMBOLS = [
  "_prime_site_caches",
  "add_site_meta",
  "clean_blog_cache",
  "delete_site_meta",
  "delete_site_meta_by_key",
  "get_site",
  "get_site_meta",
  "get_sites",
  "update_site_cache",
  "update_site_meta",
  "update_sitemeta_cache",
  "wp_cache_set_sites_last_changed",
  "wp_delete_site",
  "wp_initialize_site",
  "wp_insert_site",
  "wp_is_site_initialized",
  "wp_update_site"
];

const NETWORK_LOOKUP_SYMBOLS = [
  "_prime_network_caches",
  "clean_network_cache",
  "get_current_site_name",
  "get_network",
  "get_network_by_path",
  "get_networks",
  "get_site_by_path",
  "is_subdomain_install",
  "ms_load_current_site_and_network",
  "ms_site_check",
  "update_network_cache",
  "wp_get_active_network_plugins",
  "wp_get_network",
  "wpmu_current_site"
];

const SIGNUP_LIFECYCLE_SYMBOLS = [
  "add_existing_user_to_blog",
  "add_new_user_to_blog",
  "add_user_to_blog",
  "domain_exists",
  "get_active_blog_for_user",
  "get_blog_count",
  "get_blog_id_from_url",
  "get_space_allowed",
  "get_space_used",
  "get_upload_space_available",
  "is_email_address_unsafe",
  "is_upload_space_available",
  "remove_user_from_blog",
  "wp_is_large_network",
  "wp_maybe_update_network_site_counts",
  "wp_maybe_update_network_user_counts",
  "wp_update_network_counts",
  "wp_update_network_site_counts",
  "wp_update_network_user_counts",
  "wpmu_activate_signup",
  "wpmu_create_blog",
  "wpmu_create_user",
  "wpmu_signup_blog",
  "wpmu_signup_user",
  "wpmu_validate_blog_signup",
  "wpmu_validate_user_signup"
];

const NETWORK_ADMIN_SYMBOLS = [
  "allow_subdirectory_install",
  "allow_subdomain_install",
  "can_edit_network",
  "check_upload_size",
  "choose_primary_blog",
  "confirm_delete_users",
  "display_space_usage",
  "get_clean_basedomain",
  "network_domain_check",
  "network_edit_site_nav",
  "network_settings_add_js",
  "network_step1",
  "network_step2",
  "upload_is_user_over_quota",
  "wpmu_delete_blog",
  "wpmu_delete_user"
];

const DOMAINS = [
  {
    id: "site_network_options",
    label: "Site/network options and sitemeta-backed storage",
    source_paths: ["src/wp-includes/option.php"],
    symbol_filter: (entry) => entry.path === "src/wp-includes/option.php" && SITE_NETWORK_OPTION_SYMBOLS.includes(entry.name),
    test_paths: [
      "tests/phpunit/tests/option/siteOption.php",
      "tests/phpunit/tests/option/networkOption.php",
      "tests/phpunit/tests/option/multisite.php",
      "tests/phpunit/tests/option/wpPrimeNetworkOptionCaches.php",
      "tests/phpunit/tests/multisite/siteMeta.php"
    ],
    risk_tags: ["sitemeta", "network-id", "cache-priming", "global-cache-groups", "database-storage", "filters"],
    fixture_seeds: ["get_site_option", "update_site_option", "get_network_option", "update_network_option", "wp_prime_network_option_caches"]
  },
  {
    id: "site_transients",
    label: "Site transients and expiration behavior",
    source_paths: ["src/wp-includes/option.php"],
    symbol_filter: (entry) => entry.path === "src/wp-includes/option.php" && SITE_TRANSIENT_SYMBOLS.includes(entry.name),
    test_paths: ["tests/phpunit/tests/option/siteTransient.php", "tests/phpunit/tests/option/multisite.php"],
    risk_tags: ["site-transients", "timeout-value-pairing", "expiration", "cache-groups", "database-storage"],
    fixture_seeds: ["set_site_transient", "get_site_transient", "delete_site_transient", "delete_expired_transients"]
  },
  {
    id: "site_blog_switching",
    label: "Blog lookup, blog options, status, and blog switching",
    source_paths: ["src/wp-includes/ms-blogs.php", "src/wp-includes/cache.php", "src/wp-includes/class-wp-object-cache.php"],
    symbol_filter: (entry) =>
      (entry.path === "src/wp-includes/ms-blogs.php" && SITE_BLOG_SWITCHING_SYMBOLS.includes(entry.name)) ||
      (entry.path === "src/wp-includes/cache.php" && entry.name.includes("wp_cache")) ||
      (entry.path === "src/wp-includes/class-wp-object-cache.php" && entry.name === "WP_Object_Cache::switch_to_blog"),
    test_paths: [
      "tests/phpunit/tests/multisite/getBlogDetails.php",
      "tests/phpunit/tests/multisite/getIdFromBlogname.php",
      "tests/phpunit/tests/multisite/updateBlogDetails.php",
      "tests/phpunit/tests/multisite/updateBlogStatus.php",
      "tests/phpunit/tests/multisite/wpCacheSwitchToBlogFallback.php",
      "tests/phpunit/tests/multisite/wpCountSites.php"
    ],
    risk_tags: ["global-blog-id", "switched-stack", "cache-group-scope", "blog-option-compat", "site-status"],
    fixture_seeds: ["switch_to_blog", "restore_current_blog", "get_blog_details", "update_blog_details", "wp_cache_switch_to_blog_fallback"]
  },
  {
    id: "site_objects_queries_lifecycle",
    label: "WP_Site objects, queries, site meta, and lifecycle",
    source_paths: ["src/wp-includes/ms-site.php", "src/wp-includes/class-wp-site.php", "src/wp-includes/class-wp-site-query.php"],
    symbol_filter: (entry) =>
      (entry.path === "src/wp-includes/ms-site.php" && SITE_LIFECYCLE_SYMBOLS.includes(entry.name)) ||
      entry.path === "src/wp-includes/class-wp-site.php" ||
      entry.path === "src/wp-includes/class-wp-site-query.php",
    test_paths: [
      "tests/phpunit/tests/multisite/site.php",
      "tests/phpunit/tests/multisite/getSite.php",
      "tests/phpunit/tests/multisite/wpGetSites.php",
      "tests/phpunit/tests/multisite/wpSiteQuery.php",
      "tests/phpunit/tests/multisite/siteMeta.php",
      "tests/phpunit/tests/multisite/getMainSiteId.php"
    ],
    risk_tags: ["public-class-abi", "magic-properties", "query-sql", "site-meta", "lifecycle-hooks", "cache-invalidation"],
    fixture_seeds: ["WP_Site", "WP_Site_Query", "get_site", "get_sites", "wp_insert_site", "wp_update_site", "wp_delete_site"]
  },
  {
    id: "network_objects_bootstrap",
    label: "Network objects, queries, lookup, and bootstrap routing",
    source_paths: [
      "src/wp-includes/ms-network.php",
      "src/wp-includes/ms-load.php",
      "src/wp-includes/class-wp-network.php",
      "src/wp-includes/class-wp-network-query.php"
    ],
    symbol_filter: (entry) =>
      (["src/wp-includes/ms-network.php", "src/wp-includes/ms-load.php"].includes(entry.path) &&
        NETWORK_LOOKUP_SYMBOLS.includes(entry.name)) ||
      entry.path === "src/wp-includes/class-wp-network.php" ||
      entry.path === "src/wp-includes/class-wp-network-query.php",
    test_paths: [
      "tests/phpunit/tests/multisite/network.php",
      "tests/phpunit/tests/multisite/wpNetworkQuery.php",
      "tests/phpunit/tests/multisite/bootstrap.php",
      "tests/phpunit/tests/multisite/populateNetworkHooks.php"
    ],
    risk_tags: ["public-class-abi", "domain-path-routing", "bootstrap-order", "conditional-globals", "network-cache"],
    fixture_seeds: ["WP_Network", "WP_Network_Query", "get_network", "get_networks", "ms_load_current_site_and_network", "get_site_by_path"]
  },
  {
    id: "signup_lifecycle_upload_quotas",
    label: "Network signup, site/user lifecycle, counts, and quotas",
    source_paths: ["src/wp-includes/ms-functions.php"],
    symbol_filter: (entry) => entry.path === "src/wp-includes/ms-functions.php" && SIGNUP_LIFECYCLE_SYMBOLS.includes(entry.name),
    test_paths: [
      "tests/phpunit/tests/multisite/wpmuValidateBlogSignup.php",
      "tests/phpunit/tests/multisite/wpmuValidateUserSignup.php",
      "tests/phpunit/tests/multisite/wpmuLogNewRegistrations.php",
      "tests/phpunit/tests/multisite/isEmailAddressUnsafe.php",
      "tests/phpunit/tests/multisite/isUploadSpaceAvailable.php",
      "tests/phpunit/tests/multisite/getSpaceAllowed.php",
      "tests/phpunit/tests/multisite/getSpaceUsed.php",
      "tests/phpunit/tests/multisite/uploadIsUserOverQuota.php",
      "tests/phpunit/tests/multisite/updatePostsCount.php",
      "tests/phpunit/tests/user/multisite.php"
    ],
    risk_tags: ["signup-activation", "user-site-links", "quota", "email-notifications", "network-counts", "db-writes"],
    fixture_seeds: ["wpmu_validate_blog_signup", "wpmu_validate_user_signup", "wpmu_create_blog", "wpmu_activate_signup", "get_space_allowed"]
  },
  {
    id: "network_admin_runtime",
    label: "Network admin setup and runtime helpers",
    source_paths: ["src/wp-admin/includes/network.php", "src/wp-admin/includes/ms.php"],
    symbol_filter: (entry) =>
      (entry.path === "src/wp-admin/includes/network.php" || entry.path === "src/wp-admin/includes/ms.php") &&
      NETWORK_ADMIN_SYMBOLS.includes(entry.name),
    test_paths: [
      "tests/phpunit/tests/multisite/avoidBlogPagePermalinkCollision.php",
      "tests/phpunit/tests/multisite/wpMsSitesListTable.php",
      "tests/phpunit/tests/multisite/wpMsThemesListTable.php",
      "tests/phpunit/tests/multisite/wpMsUsersListTable.php"
    ],
    risk_tags: ["network-admin", "capabilities", "list-tables", "quota-ui", "site-user-admin", "generated-config"],
    fixture_seeds: ["network_domain_check", "network_step1", "network_step2", "wpmu_delete_blog", "upload_is_user_over_quota"]
  }
];

const FOLLOW_UP_SLICES = [
  {
    external_ref: "WPHX-317.02",
    title: "Build site/network option and site-transient differential fixtures",
    depends_on: ["WPHX-317.01"],
    fixture_focus: ["get_site_option", "update_site_option", "get_network_option", "set_site_transient", "sitemeta cache"]
  },
  {
    external_ref: "WPHX-317.03",
    title: "Build site/blog switching and cache-group differential fixtures",
    depends_on: ["WPHX-317.01"],
    fixture_focus: ["switch_to_blog", "restore_current_blog", "ms_is_switched", "global cache groups", "blog option compatibility"]
  },
  {
    external_ref: "WPHX-317.04",
    title: "Build WP_Site and WP_Network ABI/query fixtures",
    depends_on: ["WPHX-317.01"],
    fixture_focus: ["WP_Site", "WP_Site_Query", "WP_Network", "WP_Network_Query", "magic properties", "query vars"]
  },
  {
    external_ref: "WPHX-317.05",
    title: "Build multisite bootstrap/domain-path routing fixtures",
    depends_on: ["WPHX-317.01"],
    fixture_focus: ["ms_load_current_site_and_network", "get_site_by_path", "get_network_by_path", "active network plugins"]
  },
  {
    external_ref: "WPHX-317.06",
    title: "Build signup, lifecycle, counts, and quota fixtures",
    depends_on: ["WPHX-317.01"],
    fixture_focus: ["wpmu_validate_blog_signup", "wpmu_create_blog", "wpmu_activate_signup", "network counts", "upload quotas"]
  },
  {
    external_ref: "WPHX-317.07",
    title: "Promote first multisite pure helpers to Haxe parity candidates",
    depends_on: ["WPHX-317.02", "WPHX-317.03", "WPHX-317.04"],
    fixture_focus: ["site/network option decision helpers", "switch-stack model", "site/network public shape normalization"]
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function byBaselinePath(records, path) {
  return records.find((record) => record.baseline === BASELINE && record.path === path);
}

function sourceRecord(sourceInventory, unit) {
  const inventory = byBaselinePath(sourceInventory, unit.path);
  if (!inventory) throw new Error(`Missing source inventory record for ${unit.path}`);
  return {
    ...unit,
    id: inventory.id,
    baseline: inventory.baseline,
    repo: inventory.repo,
    commit: inventory.commit,
    language: inventory.language,
    inventory_status: inventory.status,
    classified: inventory.classified,
    bytes: statSync(upstreamPath(unit.path)).size,
    sha256: sha256File(upstreamPath(unit.path)),
    git_object: inventory.gitObject
  };
}

function testRecord(testInventory, path, category, relation = "primary") {
  const inventory = byBaselinePath(testInventory, path);
  if (!inventory) throw new Error(`Missing test inventory record for ${path}`);
  return {
    category,
    relation,
    id: inventory.id,
    path: inventory.path,
    repo: inventory.repo,
    commit: inventory.commit,
    framework: inventory.framework,
    sha256: sha256File(upstreamPath(path))
  };
}

function collectTests(testInventory, domain) {
  const tests = [];
  for (const path of domain.test_paths ?? []) {
    tests.push(testRecord(testInventory, path, domain.id));
  }
  for (const prefix of domain.test_prefixes ?? []) {
    for (const record of testInventory.filter((entry) => entry.baseline === BASELINE && entry.path.startsWith(prefix))) {
      tests.push(testRecord(testInventory, record.path, domain.id));
    }
  }
  for (const path of domain.related_test_paths ?? []) {
    tests.push(testRecord(testInventory, path, domain.id, "related"));
  }
  const seen = new Set();
  return tests
    .filter((test) => {
      if (seen.has(test.path)) return false;
      seen.add(test.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function abiSymbol(entry, category) {
  return {
    category,
    kind: entry.kind,
    name: entry.qualified_name ?? entry.name,
    local_name: entry.local_name ?? entry.name,
    path: entry.path,
    distribution_path: entry.distribution_path,
    start_line: entry.location?.start_line ?? null,
    declaration_timing: entry.declaration_timing,
    signature_hash: entry.signature_hash,
    source_hash: entry.source_hash,
    parameter_count: entry.parameters?.length ?? 0,
    return_type: entry.return_type ?? null
  };
}

function collectSymbols(abi, domain) {
  return abi.entries
    .filter((entry) => ["function", "class", "method", "property"].includes(entry.kind))
    .filter(domain.symbol_filter)
    .map((entry) => abiSymbol(entry, domain.id))
    .sort((a, b) => a.path.localeCompare(b.path) || a.start_line - b.start_line || a.name.localeCompare(b.name));
}

function buildDomainRecords(abi, testInventory) {
  return DOMAINS.map((domain) => {
    const symbols = collectSymbols(abi, domain);
    const tests = collectTests(testInventory, domain);
    if (symbols.length === 0) throw new Error(`${domain.id} selected no ABI symbols`);
    if (tests.length === 0) throw new Error(`${domain.id} selected no tests`);
    return {
      id: domain.id,
      label: domain.label,
      source_paths: domain.source_paths,
      risk_tags: domain.risk_tags,
      fixture_seeds: domain.fixture_seeds,
      symbol_count: symbols.length,
      test_count: tests.length,
      symbols,
      tests
    };
  });
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-317-multisite-surface`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/multisite-network-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "multisite/network surface",
      area: "wp-includes/wp-admin",
      public_contract:
        "WordPress 7.0 multisite/network PHP ABI and observable behavior remain oracle-owned until per-slice Haxe parity candidates replace site options, site transients, blog switching, site/network objects, bootstrap routing, signup/lifecycle, and network admin helpers."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: PRIMARY_SOURCE_UNITS.map((unit) => unit.path),
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-multisite-network-surface.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-317-multisite-surface",
        "npm run wp:core:wphx-317-multisite-surface:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-317-01-multisite-network-surface"],
      manifest_digest: manifestSha
    },
    notes:
      "This first WPHX-317 slice inventories the oracle surface and fixture entry points only. Runtime multisite/network logic remains external_oracle until later WPHX-317.x slices create Haxe parity candidates and replacement gates."
  };
}

const sourceInventory = readJsonl(SOURCE_INVENTORY);
const testInventory = readJsonl(TEST_INVENTORY);
const abi = readJson(ABI);
const sourceUnits = PRIMARY_SOURCE_UNITS.map((unit) => sourceRecord(sourceInventory, unit));
const domains = buildDomainRecords(abi, testInventory);
const publicSymbols = domains.flatMap((domain) => domain.symbols);
const upstreamDigest = sha256(
  JSON.stringify(
    sourceUnits.map((unit) => ({
      path: unit.path,
      sha256: unit.sha256
    }))
  )
);
const manifest = {
  schema: "wphx.wp-core-multisite-network-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-multisite-network-surface.mjs",
  inputs: {
    source_inventory: inputRecord(SOURCE_INVENTORY),
    test_inventory: inputRecord(TEST_INVENTORY),
    php_abi: inputRecord(ABI),
    upstream_repo: UPSTREAM_ROOT,
    upstream_ref: WP_REF,
    upstream_digest: upstreamDigest
  },
  source_units: sourceUnits,
  deferred_cross_domain_behaviors: DEFERRED_CROSS_DOMAIN_BEHAVIORS,
  domains,
  public_symbol_count: publicSymbols.length,
  public_symbol_names: uniqueSorted(publicSymbols.map((symbol) => symbol.name)),
  upstream_test_count: domains.reduce((total, domain) => total + domain.test_count, 0),
  first_fixture_targets: [
    {
      id: "site-network-options",
      issue_external_ref: "WPHX-317.02",
      symbols: ["get_site_option", "update_site_option", "get_network_option", "update_network_option", "wp_prime_network_option_caches"],
      oracle_focus: "Sitemeta storage, network-id selection, false/default contracts, cache priming, and filter behavior"
    },
    {
      id: "site-transients",
      issue_external_ref: "WPHX-317.02",
      symbols: ["set_site_transient", "get_site_transient", "delete_site_transient", "delete_expired_transients"],
      oracle_focus: "Timeout/value pairing, expiration cleanup, site transient cache keys, and database fallback"
    },
    {
      id: "blog-switching-cache-groups",
      issue_external_ref: "WPHX-317.03",
      symbols: ["switch_to_blog", "restore_current_blog", "ms_is_switched", "wp_cache_switch_to_blog_fallback"],
      oracle_focus: "Global blog ID, switched stack, cache group scoping, role/user switching, and restoration failure surfaces"
    },
    {
      id: "site-network-public-objects",
      issue_external_ref: "WPHX-317.04",
      symbols: ["WP_Site", "WP_Site_Query", "WP_Network", "WP_Network_Query"],
      oracle_focus: "Reflection-visible class ABI, public property order, magic accessors, query vars, SQL clauses, and found-count behavior"
    },
    {
      id: "multisite-bootstrap-routing",
      issue_external_ref: "WPHX-317.05",
      symbols: ["ms_load_current_site_and_network", "get_site_by_path", "get_network_by_path", "wp_get_active_network_plugins"],
      oracle_focus: "Domain/path routing, current site/network globals, load order, unavailable-site behavior, and active network plugin resolution"
    },
    {
      id: "signup-lifecycle-quotas",
      issue_external_ref: "WPHX-317.06",
      symbols: ["wpmu_validate_blog_signup", "wpmu_validate_user_signup", "wpmu_create_blog", "wpmu_activate_signup", "get_space_allowed"],
      oracle_focus: "Signup validation, site/user creation, activation keys, quota decisions, network counts, and notification side effects"
    }
  ],
  follow_up_slices: FOLLOW_UP_SLICES,
  validation_result: {
    status: "passed",
    source_units: sourceUnits.length,
    deferred_cross_domain_behaviors: DEFERRED_CROSS_DOMAIN_BEHAVIORS.length,
    domains: domains.length,
    public_symbols: publicSymbols.length,
    upstream_tests: domains.reduce((total, domain) => total + domain.test_count, 0),
    ownership_state: "external_oracle"
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-317-01-multisite-network-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "WPHX-317.01 generated domain surface manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for this first multisite/network domain surface"
    },
    {
      path: "tools/wp-core/run-multisite-network-surface.mjs",
      role: "deterministic generator and drift check"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-317-multisite-surface",
    "npm run wp:core:wphx-317-multisite-surface:check",
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
