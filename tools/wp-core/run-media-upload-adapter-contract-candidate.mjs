#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.19.2",
  external_ref: "WPHX-313.02",
  title: "WPHX-313.02 - Add media upload adapter-contract candidate"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const HXML = "fixtures/wp-core/media-upload-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-313-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json";
const OUT = "manifests/wp-core/wphx-313-02-media-upload-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-313-02-media-upload-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-313-02-media-upload-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-media-upload-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/media/MediaUploadAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/MediaUploadAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "upload:no-file": "upload_no_file",
  "upload:php-error": "upload_php_error",
  "upload:form": "upload_form_rejected",
  "upload:size": "upload_too_large",
  "upload:mime-reject": "upload_mime_rejected",
  "upload:override": "upload_override_accepted",
  "upload:accepted": "upload_accepted",
  "mime:unknown": "mime_unknown_extension",
  "mime:rejected": "mime_rejected",
  "mime:mismatch": "mime_real_mismatch",
  "mime:allowed": "mime_allowed",
  "unique:preserve": "unique_preserve",
  "unique:sanitized": "unique_sanitized",
  "unique:suffix": "unique_suffix",
  "unique:increment": "unique_increment",
  "unique:lowercase": "unique_lowercase_extension",
  "meta:no-editor": "metadata_editor_unavailable",
  "meta:basic": "metadata_basic_attachment",
  "meta:preserve": "metadata_preserve_existing",
  "meta:subsizes": "metadata_generate_subsizes",
  "meta:identify": "metadata_identify_image",
  "fs:credentials": "filesystem_credentials_required",
  "fs:direct": "filesystem_direct",
  "fs:ssh2": "filesystem_ssh2",
  "fs:ftp": "filesystem_ftp",
  "fs:unavailable": "filesystem_unavailable",
  "hook:prefilter": "media_upload_prefilter_hooks",
  "hook:mime": "media_upload_mime_hooks",
  "hook:attachment": "media_attachment_hooks",
  "hook:filesystem": "media_filesystem_hooks",
  "hook:failed": "media_upload_no_hooks"
};

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

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

function stableGeneratedContents(data) {
  return data
    .toString("utf8")
    .replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
}

function filesUnder(root) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      if (entry.isFile()) {
        const stableContents = stableGeneratedContents(readFileSync(child));
        files.push({
          path: relative(root, child),
          bytes: Buffer.byteLength(stableContents),
          sha256: createHash("sha256").update(stableContents).digest("hex")
        });
      }
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source),
    contains_raw_javascript: /\bjs\.Syntax\b/.test(source)
  };
}

function parseOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Unexpected output line: ${line}`);
    result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

function generatedPhpLintRecords(paths) {
  return paths
    .filter((record) => record.path.endsWith(".php"))
    .map((record) => ({
      path: `${HAXE_OUT}/${record.path}`,
      relative_path: record.path,
      sha256: `sha256:${record.sha256}`,
      php_lint: command("php", ["-l", `${HAXE_OUT}/${record.path}`])
    }));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-313-media-upload-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/media-upload-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "media upload validation, MIME/filetype, unique filename, attachment metadata, filesystem, and hook intent",
      area:
        "wp-admin/includes/file.php wp-admin/includes/image.php wp-includes/media.php wp-includes/post-thumbnail-template.php wp-admin/includes/media.php",
      public_contract:
        "Haxe owns the first typed WPHX-313 media/upload adapter-contract decision model. Public PHP ABI replacement, native file IO, image editor execution, REST/admin upload flows, multisite quota behavior, and installed media behavior are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Install these decisions through typed Adapter IR/original-path generation and pass PHP-authored upload validation, MIME/filetype, unique filename, attachment metadata, image editor, filesystem credential, REST/admin upload, multisite quota, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-313-media-upload-adapter-contract-candidate",
        "npm run wp:core:wphx-313-media-upload-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-313-02-media-upload-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate with module-level Haxe functions. It adds no native provider, no handwritten production PHP shell, and no public WordPress file replacement."
  };
}

const lock = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);

const generatedFiles = filesUnder(HAXE_OUT);
const output = command("php", [ENTRY]);
const observations = parseOutput(output);
const matchesExpected = JSON.stringify(observations) === JSON.stringify(EXPECTED);
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);

if (!matchesExpected || !sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", matchesExpected, observations, haxeSourceAudits }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-media-upload-adapter-contract-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "generated_shape"],
  artifact_scope: "helper",
  inputs: {
    prior_manifest: inputRecord(PRIOR_MANIFEST),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  fixture: {
    candidate_kind: "haxe_media_upload_adapter_contract_candidate",
    promoted_contracts: [
      "upload validation intent for missing file, PHP upload error, form test, size limit, MIME rejection, override, and accepted routes",
      "MIME/filetype intent for unknown extensions, rejected types, strict real-MIME mismatch, and allowed files",
      "unique filename intent for preserved, sanitized, suffixed, incremented, and lowercase-extension routes",
      "attachment metadata and image-editor intent for no editor, basic attachment, preserving existing metadata, generated subsizes, and image identification",
      "filesystem intent for missing credentials, direct access, SSH2, FTP, and unavailable routes",
      "media upload, MIME, attachment metadata, filesystem credential, and failure hook intent"
    ],
    upstream_reference_functions: [
      "_wp_handle_upload",
      "wp_handle_upload",
      "wp_check_filetype_and_ext",
      "wp_unique_filename",
      "sanitize_file_name",
      "wp_generate_attachment_metadata",
      "wp_create_image_subsizes",
      "wp_get_image_editor",
      "request_filesystem_credentials",
      "WP_Filesystem"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      native_provider_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP media/upload/filesystem fixtures before claiming public PHP ABI ownership."
    },
    source_escape_audits: haxeSourceAudits
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_profile: command("php", ["-r", "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"])
  },
  build: {
    generated_file_hash_policy: "normalize_haxe_std_source_map_paths",
    generated_haxe_files: generatedFiles,
    php_lint: generatedPhpLintRecords(generatedFiles)
  },
  run: {
    command: `php ${ENTRY}`,
    raw_output_sha256: sha256(output),
    observations,
    matches_expected: matchesExpected
  },
  remaining_gaps: [
    {
      id: "php-authored-media-upload-oracle-fixtures-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run through vanilla WordPress and packaged candidate upload validation, MIME/filetype, unique filename, attachment metadata, image editor, filesystem credential, REST/admin upload, multisite quota, hook, and filesystem side-effect observations."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path media, upload, image metadata, filesystem, REST attachment, or admin upload adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_media_upload_adapter_contract_candidate",
    promoted_contracts: 6,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-313-02-media-upload-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "media/upload Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for media/upload Haxe candidate" },
    { path: "src/wphx/wp/media/MediaUploadAdapterContract.hx", role: "typed Haxe media/upload semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-313-media-upload-adapter-contract-candidate",
    "npm run wp:core:wphx-313-media-upload-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  related_receipts: ["receipt:wphx-313-01-media-filesystem-upload-surface"],
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
      observations: Object.keys(EXPECTED).length
    },
    null,
    2
  )
);
