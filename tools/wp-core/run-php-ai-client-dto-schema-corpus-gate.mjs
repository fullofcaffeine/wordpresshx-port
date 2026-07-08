#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.4",
  external_ref: "WPHX-323.26",
  title: "Add php-ai-client DTO schema corpus gate"
};
const RECORDED_AT = "2026-07-08T23:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-php-ai-client-dto-schema-corpus-gate.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const PHP_AI_CLIENT_SUB_BOUNDARIES = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const WORDPRESS_AI_WRAPPER_SURFACE = "manifests/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";
const WORDPRESS_AI_WRAPPER_GENERATED_ADAPTER =
  "manifests/wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json";
const OUT = "manifests/wp-core/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json";

const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const OUT_ROOT = "build/wp-core/wphx-323-26";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/php-ai-client-dto-schema-corpus-probe.php`;
const EXPECTED_PHP_FILE_COUNT = 146;

const PHP_AI_CLIENT_CLASS_FIXTURES = [
  {
    path: "src/wp-includes/php-ai-client/src/Common/AbstractDataTransferObject.php",
    fqn: "WordPress\\AiClient\\Common\\AbstractDataTransferObject",
    group: "schema_base",
    kind: "abstract_class"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Common/AbstractEnum.php",
    fqn: "WordPress\\AiClient\\Common\\AbstractEnum",
    group: "enum_base",
    kind: "abstract_class"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Common/Contracts/WithArrayTransformationInterface.php",
    fqn: "WordPress\\AiClient\\Common\\Contracts\\WithArrayTransformationInterface",
    group: "schema_contract",
    kind: "interface"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Common/Contracts/WithJsonSchemaInterface.php",
    fqn: "WordPress\\AiClient\\Common\\Contracts\\WithJsonSchemaInterface",
    group: "schema_contract",
    kind: "interface"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Files/DTO/File.php",
    fqn: "WordPress\\AiClient\\Files\\DTO\\File",
    group: "file_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Files/Enums/FileTypeEnum.php",
    fqn: "WordPress\\AiClient\\Files\\Enums\\FileTypeEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Files/Enums/MediaOrientationEnum.php",
    fqn: "WordPress\\AiClient\\Files\\Enums\\MediaOrientationEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/DTO/Message.php",
    fqn: "WordPress\\AiClient\\Messages\\DTO\\Message",
    group: "message_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/DTO/MessagePart.php",
    fqn: "WordPress\\AiClient\\Messages\\DTO\\MessagePart",
    group: "message_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/DTO/ModelMessage.php",
    fqn: "WordPress\\AiClient\\Messages\\DTO\\ModelMessage",
    group: "message_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/DTO/UserMessage.php",
    fqn: "WordPress\\AiClient\\Messages\\DTO\\UserMessage",
    group: "message_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/Enums/MessagePartChannelEnum.php",
    fqn: "WordPress\\AiClient\\Messages\\Enums\\MessagePartChannelEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/Enums/MessagePartTypeEnum.php",
    fqn: "WordPress\\AiClient\\Messages\\Enums\\MessagePartTypeEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/Enums/MessageRoleEnum.php",
    fqn: "WordPress\\AiClient\\Messages\\Enums\\MessageRoleEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Messages/Enums/ModalityEnum.php",
    fqn: "WordPress\\AiClient\\Messages\\Enums\\ModalityEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Operations/Contracts/OperationInterface.php",
    fqn: "WordPress\\AiClient\\Operations\\Contracts\\OperationInterface",
    group: "operation_contract",
    kind: "interface"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Operations/DTO/GenerativeAiOperation.php",
    fqn: "WordPress\\AiClient\\Operations\\DTO\\GenerativeAiOperation",
    group: "operation_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Operations/Enums/OperationStateEnum.php",
    fqn: "WordPress\\AiClient\\Operations\\Enums\\OperationStateEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/DTO/ProviderMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\DTO\\ProviderMetadata",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/DTO/ProviderModelsMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\DTO\\ProviderModelsMetadata",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Enums/ProviderTypeEnum.php",
    fqn: "WordPress\\AiClient\\Providers\\Enums\\ProviderTypeEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Enums/ToolTypeEnum.php",
    fqn: "WordPress\\AiClient\\Providers\\Enums\\ToolTypeEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Contracts/RequestAuthenticationInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Contracts\\RequestAuthenticationInterface",
    group: "http_contract",
    kind: "interface"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/ApiKeyRequestAuthentication.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication",
    group: "http_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Request.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\Request",
    group: "http_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/RequestOptions.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions",
    group: "http_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Response.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\Response",
    group: "http_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Enums/HttpMethodEnum.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Enums\\HttpMethodEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Enums/RequestAuthenticationMethod.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Enums\\RequestAuthenticationMethod",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelConfig.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelConfig",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelMetadata",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelRequirements.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelRequirements",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/RequiredOption.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\RequiredOption",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/SupportedOption.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\SupportedOption",
    group: "provider_model_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/Enums/CapabilityEnum.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\Enums\\CapabilityEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/Enums/OptionEnum.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\Enums\\OptionEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Results/Contracts/ResultInterface.php",
    fqn: "WordPress\\AiClient\\Results\\Contracts\\ResultInterface",
    group: "result_contract",
    kind: "interface"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Results/DTO/Candidate.php",
    fqn: "WordPress\\AiClient\\Results\\DTO\\Candidate",
    group: "result_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Results/DTO/GenerativeAiResult.php",
    fqn: "WordPress\\AiClient\\Results\\DTO\\GenerativeAiResult",
    group: "result_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Results/DTO/TokenUsage.php",
    fqn: "WordPress\\AiClient\\Results\\DTO\\TokenUsage",
    group: "result_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Results/Enums/FinishReasonEnum.php",
    fqn: "WordPress\\AiClient\\Results\\Enums\\FinishReasonEnum",
    group: "enum",
    kind: "enum"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Tools/DTO/FunctionCall.php",
    fqn: "WordPress\\AiClient\\Tools\\DTO\\FunctionCall",
    group: "tool_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Tools/DTO/FunctionDeclaration.php",
    fqn: "WordPress\\AiClient\\Tools\\DTO\\FunctionDeclaration",
    group: "tool_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Tools/DTO/FunctionResponse.php",
    fqn: "WordPress\\AiClient\\Tools\\DTO\\FunctionResponse",
    group: "tool_dto",
    kind: "dto"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Tools/DTO/WebSearch.php",
    fqn: "WordPress\\AiClient\\Tools\\DTO\\WebSearch",
    group: "tool_dto",
    kind: "dto"
  }
];

const ENUM_SAMPLES = [
  ["WordPress\\AiClient\\Files\\Enums\\FileTypeEnum", "inline"],
  ["WordPress\\AiClient\\Files\\Enums\\MediaOrientationEnum", "landscape"],
  ["WordPress\\AiClient\\Messages\\Enums\\MessagePartChannelEnum", "content"],
  ["WordPress\\AiClient\\Messages\\Enums\\MessagePartTypeEnum", "text"],
  ["WordPress\\AiClient\\Messages\\Enums\\MessageRoleEnum", "user"],
  ["WordPress\\AiClient\\Messages\\Enums\\ModalityEnum", "text"],
  ["WordPress\\AiClient\\Operations\\Enums\\OperationStateEnum", "succeeded"],
  ["WordPress\\AiClient\\Providers\\Enums\\ProviderTypeEnum", "cloud"],
  ["WordPress\\AiClient\\Providers\\Enums\\ToolTypeEnum", "function_declarations"],
  ["WordPress\\AiClient\\Providers\\Http\\Enums\\HttpMethodEnum", "POST"],
  ["WordPress\\AiClient\\Providers\\Http\\Enums\\RequestAuthenticationMethod", "api_key"],
  ["WordPress\\AiClient\\Providers\\Models\\Enums\\CapabilityEnum", "text_generation"],
  ["WordPress\\AiClient\\Providers\\Models\\Enums\\OptionEnum", "temperature"],
  ["WordPress\\AiClient\\Results\\Enums\\FinishReasonEnum", "stop"]
];

const SUBSET_CANDIDATE_LIST = [
  {
    id: "enum_value_objects",
    sequence: 1,
    candidate_state: "candidate_after_generated_subset_receipt",
    refs: ["WPHX-323.26", "WPHX-COMP-PHP-USABLE"],
    classes: ENUM_SAMPLES.map(([fqn]) => fqn),
    required_followup_before_claim:
      "Generate PHP enum-like value objects from typed Haxe or Adapter IR, prove singleton/static-magic/json/reflection behavior, and record a generated subset receipt."
  },
  {
    id: "leaf_dtos",
    sequence: 2,
    candidate_state: "candidate_after_enum_value_objects",
    classes: [
      "WordPress\\AiClient\\Results\\DTO\\TokenUsage",
      "WordPress\\AiClient\\Tools\\DTO\\FunctionDeclaration",
      "WordPress\\AiClient\\Tools\\DTO\\FunctionCall",
      "WordPress\\AiClient\\Tools\\DTO\\FunctionResponse",
      "WordPress\\AiClient\\Tools\\DTO\\WebSearch",
      "WordPress\\AiClient\\Providers\\Models\\DTO\\RequiredOption",
      "WordPress\\AiClient\\Providers\\Models\\DTO\\SupportedOption",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\Response",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication"
    ],
    required_followup_before_claim:
      "Generated leaf DTOs must preserve constructor/default/type reflection, toArray/fromArray/jsonSerialize/schema behavior, clone behavior where present, and namespace/autoload identity."
  },
  {
    id: "nested_message_result_graph",
    sequence: 3,
    candidate_state: "candidate_after_leaf_dtos",
    classes: [
      "WordPress\\AiClient\\Files\\DTO\\File",
      "WordPress\\AiClient\\Messages\\DTO\\MessagePart",
      "WordPress\\AiClient\\Messages\\DTO\\Message",
      "WordPress\\AiClient\\Messages\\DTO\\UserMessage",
      "WordPress\\AiClient\\Messages\\DTO\\ModelMessage",
      "WordPress\\AiClient\\Results\\DTO\\Candidate",
      "WordPress\\AiClient\\Results\\DTO\\GenerativeAiResult",
      "WordPress\\AiClient\\Operations\\DTO\\GenerativeAiOperation"
    ],
    required_followup_before_claim:
      "Generated nested DTOs must preserve role/type validation failures, file MIME/base64/url handling, result convenience extractors, and deep clone behavior."
  },
  {
    id: "provider_model_metadata_graph",
    sequence: 4,
    candidate_state: "candidate_after_model_registry_gate_floor",
    refs: ["WPHX-323.27"],
    classes: [
      "WordPress\\AiClient\\Providers\\DTO\\ProviderMetadata",
      "WordPress\\AiClient\\Providers\\DTO\\ProviderModelsMetadata",
      "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelConfig",
      "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelMetadata",
      "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelRequirements"
    ],
    required_followup_before_claim:
      "Generated provider/model metadata must preserve list validation, dynamic OptionEnum values, requirements matching, prompt-derived requirements, and fake-provider registry fixtures."
  },
  {
    id: "transport_and_auth_request_graph",
    sequence: 5,
    candidate_state: "deferred_until_fake_transport_gate",
    refs: ["WPHX-312.05", "WPHX-323.27"],
    classes: [
      "WordPress\\AiClient\\Providers\\Http\\DTO\\Request",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\Response",
      "WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication"
    ],
    required_followup_before_claim:
      "Generated HTTP DTO ownership must be paired with fake transport/discovery fixtures for headers, JSON/form body generation, options, authentication insertion, and PSR conversions."
  }
];

const NON_CLAIMS = [
  "This gate does not claim Haxe-owned wp-includes/php-ai-client/ runtime.",
  "This gate does not claim generated public PHP replacement for any wp-includes/php-ai-client/ file.",
  "This gate does not include a generated php-ai-client subset receipt; all php-ai-client files remain copied oracle artifacts inside the executable corpus.",
  "This gate does not claim provider registry behavior, live provider behavior, network transport behavior, external provider discovery parity, credential handling safety, prompt/file privacy, installed WordPress AI behavior, or plugin ecosystem compatibility.",
  "This gate does not claim third-party dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for WordPress\\AiClientDependencies.",
  "This gate does not authorize broad hand-written PHP shells or inline raw-block implementations for php-ai-client; later ownership must cite generated PHP evidence and the shell-retirement ladder.",
  "This gate records subset candidates only; no candidate is owned until a generated subset receipt and differential fixture manifest exists."
];

const CLASS_FIXTURES_JSON_B64 = Buffer.from(JSON.stringify(PHP_AI_CLIENT_CLASS_FIXTURES), "utf8").toString("base64");
const ENUM_SAMPLES_JSON_B64 = Buffer.from(JSON.stringify(ENUM_SAMPLES), "utf8").toString("base64");

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function upstreamFileRecord(path) {
  const full = upstreamPath(path);
  return { path, bytes: statSync(full).size, sha256: sha256File(full) };
}

function sourceToDistribution(path) {
  return path.startsWith("src/") ? path.slice("src/".length) : path;
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function listRelativeFiles(root, prefix = "") {
  const full = prefix ? `${root}/${prefix}` : root;
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listRelativeFiles(root, path) : [path];
    })
    .sort();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function countBy(values, keyFn) {
  return values.reduce((counts, value) => {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function currentWordPressCheckout(upstreamLock) {
  const wordpressRepo = upstreamLock.repositories.find((repo) => repo.id === "wordpress-vanilla");
  if (!wordpressRepo) throw new Error("upstream.lock.json is missing wordpress-vanilla");
  const currentCommit = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);
  const currentTree = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD^{tree}"]);
  const statusText = command("git", ["-C", UPSTREAM_ROOT, "status", "--short"]);
  if (currentCommit !== wordpressRepo.git.commit) {
    throw new Error(`wordpress-develop commit drift: lock=${wordpressRepo.git.commit} actual=${currentCommit}`);
  }
  if (currentTree !== wordpressRepo.git.tree) {
    throw new Error(`wordpress-develop tree drift: lock=${wordpressRepo.git.tree} actual=${currentTree}`);
  }
  return {
    relative_path: wordpressRepo.relativePath,
    authority: wordpressRepo.authority,
    role: wordpressRepo.role,
    locked_commit: wordpressRepo.git.commit,
    locked_tree: wordpressRepo.git.tree,
    locked_tag: wordpressRepo.git.tag,
    current_commit: currentCommit,
    current_tree: currentTree,
    observed_dirty_state_from_lock: wordpressRepo.observedDirtyState,
    current_status_short: statusText ? statusText.split("\n") : []
  };
}

function mirrorPackage(root) {
  mkdirSync(root, { recursive: true });
  cpSync(upstreamPath(PHP_AI_CLIENT_ROOT), `${root}/${sourceToDistribution(PHP_AI_CLIENT_ROOT)}`, { recursive: true });
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

function lintFiles(paths, root) {
  return paths.map((path) => {
    const output = command("php", ["-l", `${root}/${path}`]);
    return {
      path,
      ok: output.includes("No syntax errors detected"),
      output
    };
  });
}

function packageDiffs(oracleRoot, candidateRoot) {
  const oracleFiles = listRelativeFiles(oracleRoot);
  const candidateFiles = listRelativeFiles(candidateRoot);
  const all = Array.from(new Set([...oracleFiles, ...candidateFiles])).sort();
  return all
    .map((path) => {
      const oraclePath = `${oracleRoot}/${path}`;
      const candidatePath = `${candidateRoot}/${path}`;
      const oracleExists = existsSync(oraclePath);
      const candidateExists = existsSync(candidatePath);
      if (!oracleExists || !candidateExists) {
        return { path, kind: oracleExists ? "missing_from_candidate" : "extra_in_candidate" };
      }
      const oracleSha = sha256File(oraclePath);
      const candidateSha = sha256File(candidatePath);
      if (oracleSha === candidateSha) return null;
      return {
        path,
        kind: "hash_mismatch",
        oracle_sha256: oracleSha,
        candidate_sha256: candidateSha
      };
    })
    .filter(Boolean);
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    String.raw`<?php
$root = rtrim($argv[1], '/\\');
error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

require_once $root . '/wp-includes/php-ai-client/autoload.php';

$class_fixtures = json_decode(base64_decode('${CLASS_FIXTURES_JSON_B64}'), true);
$enum_samples = json_decode(base64_decode('${ENUM_SAMPLES_JSON_B64}'), true);

function wphx_323_26_normalize($value) {
	if ($value instanceof \WordPress\AiClient\Common\AbstractEnum) {
		return $value->value;
	}
	if ($value instanceof \JsonSerializable) {
		return wphx_323_26_normalize($value->jsonSerialize());
	}
	if ($value instanceof \stdClass) {
		return array(
			'__stdClass' => true,
			'properties' => wphx_323_26_normalize((array) $value),
		);
	}
	if (is_array($value)) {
		$out = array();
		foreach ($value as $key => $item) {
			$out[$key] = wphx_323_26_normalize($item);
		}
		return $out;
	}
	if (is_object($value)) {
		return array(
			'__object' => get_class($value),
			'properties' => wphx_323_26_normalize(get_object_vars($value)),
		);
	}
	return $value;
}

function wphx_323_26_type_fingerprint($value) {
	if ($value instanceof \stdClass) {
		return 'stdClass';
	}
	if ($value instanceof \WordPress\AiClient\Common\AbstractEnum) {
		return 'enum:' . get_class($value);
	}
	if (is_object($value)) {
		return 'object:' . get_class($value);
	}
	if (is_array($value)) {
		$out = array();
		foreach ($value as $key => $item) {
			$out[$key] = wphx_323_26_type_fingerprint($item);
		}
		return $out;
	}
	return gettype($value);
}

function wphx_323_26_json_hash($value) {
	return 'sha256:' . hash('sha256', json_encode(wphx_323_26_normalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function wphx_323_26_param_summary(\ReflectionParameter $parameter) {
	$type = $parameter->getType();
	return array(
		'name' => $parameter->getName(),
		'position' => $parameter->getPosition(),
		'isOptional' => $parameter->isOptional(),
		'hasDefault' => $parameter->isDefaultValueAvailable(),
		'default' => $parameter->isDefaultValueAvailable() ? wphx_323_26_normalize($parameter->getDefaultValue()) : null,
		'hasType' => $parameter->hasType(),
		'type' => $type ? array(
			'name' => $type instanceof \ReflectionNamedType ? $type->getName() : (string) $type,
			'allowsNull' => $type->allowsNull(),
			'isBuiltin' => $type instanceof \ReflectionNamedType ? $type->isBuiltin() : null,
		) : null,
		'isPassedByReference' => $parameter->isPassedByReference(),
		'isVariadic' => $parameter->isVariadic(),
	);
}

function wphx_323_26_method_summary(\ReflectionMethod $method) {
	$returnType = $method->getReturnType();
	return array(
		'name' => $method->getName(),
		'declaringClass' => $method->getDeclaringClass()->getName(),
		'isStatic' => $method->isStatic(),
		'isFinal' => $method->isFinal(),
		'isAbstract' => $method->isAbstract(),
		'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
		'parameterCount' => $method->getNumberOfParameters(),
		'requiredParameterCount' => $method->getNumberOfRequiredParameters(),
		'parameters' => array_map('wphx_323_26_param_summary', $method->getParameters()),
		'hasReturnType' => $method->hasReturnType(),
		'returnType' => $returnType ? array(
			'name' => $returnType instanceof \ReflectionNamedType ? $returnType->getName() : (string) $returnType,
			'allowsNull' => $returnType->allowsNull(),
			'isBuiltin' => $returnType instanceof \ReflectionNamedType ? $returnType->isBuiltin() : null,
		) : null,
	);
}

function wphx_323_26_schema_summary($class) {
	if (!method_exists($class, 'getJsonSchema')) {
		return null;
	}
	$method = new \ReflectionMethod($class, 'getJsonSchema');
	if ($method->isAbstract()) {
		return null;
	}
	$schema = $class::getJsonSchema();
	$properties = isset($schema['properties']) && is_array($schema['properties']) ? array_keys($schema['properties']) : array();
	sort($properties);
	$required = isset($schema['required']) && is_array($schema['required']) ? $schema['required'] : array();
	sort($required);
	$rootKeys = array_keys($schema);
	sort($rootKeys);
	return array(
		'rootKeys' => $rootKeys,
		'type' => $schema['type'] ?? null,
		'required' => $required,
		'properties' => $properties,
		'oneOfCount' => isset($schema['oneOf']) && is_array($schema['oneOf']) ? count($schema['oneOf']) : 0,
		'anyOfCount' => isset($schema['anyOf']) && is_array($schema['anyOf']) ? count($schema['anyOf']) : 0,
		'schemaHash' => wphx_323_26_json_hash($schema),
	);
}

function wphx_323_26_reflection_summary($entry) {
	$fqn = $entry['fqn'];
	$exists = class_exists($fqn) || interface_exists($fqn) || trait_exists($fqn);
	if (!$exists) {
		return array(
			'fqn' => $fqn,
			'path' => $entry['path'],
			'expectedKind' => $entry['kind'],
			'exists' => false,
		);
	}
	$reflection = new \ReflectionClass($fqn);
	$constructor = $reflection->getConstructor();
	$methodNames = array_map(
		static fn($method) => $method->getName(),
		$reflection->getMethods(\ReflectionMethod::IS_PUBLIC)
	);
	sort($methodNames);
	$declaredMethodNames = array_map(
		static fn($method) => $method->getName(),
		array_values(array_filter(
			$reflection->getMethods(),
			static fn($method) => $method->getDeclaringClass()->getName() === $reflection->getName()
		))
	);
	sort($declaredMethodNames);
	$interfaces = $reflection->getInterfaceNames();
	sort($interfaces);
	$constants = array_keys($reflection->getConstants());
	sort($constants);
	$selectedMethods = array();
	foreach (array('__construct', 'toArray', 'fromArray', 'getJsonSchema', 'jsonSerialize', 'isArrayShape', 'cases', 'from', 'tryFrom', 'getValues', 'isValidValue') as $methodName) {
		if ($reflection->hasMethod($methodName)) {
			$selectedMethods[$methodName] = wphx_323_26_method_summary($reflection->getMethod($methodName));
		}
	}
	return array(
		'fqn' => $fqn,
		'path' => $entry['path'],
		'group' => $entry['group'],
		'expectedKind' => $entry['kind'],
		'exists' => true,
		'namespaceStartsWithWordPressAiClient' => str_starts_with($fqn, 'WordPress\\AiClient\\'),
		'isInstantiable' => $reflection->isInstantiable(),
		'isAbstract' => $reflection->isAbstract(),
		'isFinal' => $reflection->isFinal(),
		'isInterface' => $reflection->isInterface(),
		'isTrait' => $reflection->isTrait(),
		'parentClass' => $reflection->getParentClass() ? $reflection->getParentClass()->getName() : null,
		'interfaces' => $interfaces,
		'implementsJsonSerializable' => $reflection->implementsInterface(\JsonSerializable::class),
		'implementsArrayTransformation' => interface_exists('WordPress\\AiClient\\Common\\Contracts\\WithArrayTransformationInterface') ? $reflection->implementsInterface('WordPress\\AiClient\\Common\\Contracts\\WithArrayTransformationInterface') : false,
		'implementsJsonSchema' => interface_exists('WordPress\\AiClient\\Common\\Contracts\\WithJsonSchemaInterface') ? $reflection->implementsInterface('WordPress\\AiClient\\Common\\Contracts\\WithJsonSchemaInterface') : false,
		'constructor' => $constructor ? wphx_323_26_method_summary($constructor) : null,
		'publicMethods' => $methodNames,
		'declaredMethods' => $declaredMethodNames,
		'constants' => $constants,
		'selectedMethods' => $selectedMethods,
		'schemaSummary' => wphx_323_26_schema_summary($fqn),
	);
}

function wphx_323_26_constant_to_magic_method($constantName) {
	$parts = explode('_', strtolower($constantName));
	$method = array_shift($parts);
	foreach ($parts as $part) {
		$method .= ucfirst($part);
	}
	return $method;
}

function wphx_323_26_enum_summary($class, $sample) {
	$cases = array();
	foreach ($class::cases() as $case) {
		$cases[] = array(
			'name' => $case->name,
			'value' => $case->value,
			'string' => (string) $case,
			'jsonSerialize' => $case->jsonSerialize(),
		);
	}
	$from = $class::from($sample);
	$magicMethod = wphx_323_26_constant_to_magic_method($from->name);
	$isMethod = 'is' . ucfirst($magicMethod);
	return array(
		'class' => $class,
		'sample' => $sample,
		'caseCount' => count($cases),
		'cases' => $cases,
		'values' => $class::getValues(),
		'from' => array(
			'name' => $from->name,
			'value' => $from->value,
			'string' => (string) $from,
			'jsonSerialize' => $from->jsonSerialize(),
		),
		'singletonIdentity' => $from === $class::from($sample),
		'tryFromInvalidIsNull' => $class::tryFrom('__wphx_invalid__') === null,
		'isValidSample' => $class::isValidValue($sample),
		'isValidInvalid' => $class::isValidValue('__wphx_invalid__'),
		'magicStaticMethod' => $magicMethod,
		'magicStaticValue' => $class::$magicMethod()->value,
		'magicIsMethod' => $isMethod,
		'magicIsResult' => $from->$isMethod(),
	);
}

function wphx_323_26_exception_case($id, $callback) {
	try {
		$callback();
		return array(
			'id' => $id,
			'thrown' => false,
		);
	} catch (\Throwable $throwable) {
		return array(
			'id' => $id,
			'thrown' => true,
			'class' => get_class($throwable),
			'message' => $throwable->getMessage(),
		);
	}
}

function wphx_323_26_roundtrip($id, $value, $fromArrayClass = null, $extra = array()) {
	$class = $fromArrayClass ?? get_class($value);
	$array = $value->toArray();
	$fromArray = $class::fromArray($array);
	$normalizedArray = wphx_323_26_normalize($array);
	$normalizedRoundtrip = wphx_323_26_normalize($fromArray->toArray());
	$jsonSerialized = $value->jsonSerialize();
	return array(
		'id' => $id,
		'class' => get_class($value),
		'fromArrayClass' => $class,
		'roundtripClass' => get_class($fromArray),
		'array' => $normalizedArray,
		'roundtripArray' => $normalizedRoundtrip,
		'matches' => $normalizedArray === $normalizedRoundtrip,
		'isArrayShape' => method_exists($class, 'isArrayShape') ? $class::isArrayShape($array) : null,
		'jsonSerialize' => wphx_323_26_normalize($jsonSerialized),
		'jsonSerializeTypeFingerprint' => wphx_323_26_type_fingerprint($jsonSerialized),
		'jsonEncoded' => json_decode(json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), true),
		'schemaSummary' => wphx_323_26_schema_summary($class),
		'extra' => wphx_323_26_normalize($extra),
	);
}

function wphx_323_26_build_fixture_graph() {
	$TokenUsage = 'WordPress\\AiClient\\Results\\DTO\\TokenUsage';
	$FunctionDeclaration = 'WordPress\\AiClient\\Tools\\DTO\\FunctionDeclaration';
	$FunctionCall = 'WordPress\\AiClient\\Tools\\DTO\\FunctionCall';
	$FunctionResponse = 'WordPress\\AiClient\\Tools\\DTO\\FunctionResponse';
	$WebSearch = 'WordPress\\AiClient\\Tools\\DTO\\WebSearch';
	$File = 'WordPress\\AiClient\\Files\\DTO\\File';
	$Message = 'WordPress\\AiClient\\Messages\\DTO\\Message';
	$MessagePart = 'WordPress\\AiClient\\Messages\\DTO\\MessagePart';
	$UserMessage = 'WordPress\\AiClient\\Messages\\DTO\\UserMessage';
	$ModelMessage = 'WordPress\\AiClient\\Messages\\DTO\\ModelMessage';
	$MessageRoleEnum = 'WordPress\\AiClient\\Messages\\Enums\\MessageRoleEnum';
	$MessagePartChannelEnum = 'WordPress\\AiClient\\Messages\\Enums\\MessagePartChannelEnum';
	$ProviderMetadata = 'WordPress\\AiClient\\Providers\\DTO\\ProviderMetadata';
	$ProviderModelsMetadata = 'WordPress\\AiClient\\Providers\\DTO\\ProviderModelsMetadata';
	$ProviderTypeEnum = 'WordPress\\AiClient\\Providers\\Enums\\ProviderTypeEnum';
	$RequestAuthenticationMethod = 'WordPress\\AiClient\\Providers\\Http\\Enums\\RequestAuthenticationMethod';
	$RequestOptions = 'WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions';
	$Request = 'WordPress\\AiClient\\Providers\\Http\\DTO\\Request';
	$Response = 'WordPress\\AiClient\\Providers\\Http\\DTO\\Response';
	$ApiKeyRequestAuthentication = 'WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication';
	$HttpMethodEnum = 'WordPress\\AiClient\\Providers\\Http\\Enums\\HttpMethodEnum';
	$ModelConfig = 'WordPress\\AiClient\\Providers\\Models\\DTO\\ModelConfig';
	$ModelMetadata = 'WordPress\\AiClient\\Providers\\Models\\DTO\\ModelMetadata';
	$ModelRequirements = 'WordPress\\AiClient\\Providers\\Models\\DTO\\ModelRequirements';
	$RequiredOption = 'WordPress\\AiClient\\Providers\\Models\\DTO\\RequiredOption';
	$SupportedOption = 'WordPress\\AiClient\\Providers\\Models\\DTO\\SupportedOption';
	$CapabilityEnum = 'WordPress\\AiClient\\Providers\\Models\\Enums\\CapabilityEnum';
	$OptionEnum = 'WordPress\\AiClient\\Providers\\Models\\Enums\\OptionEnum';
	$ModalityEnum = 'WordPress\\AiClient\\Messages\\Enums\\ModalityEnum';
	$FileTypeEnum = 'WordPress\\AiClient\\Files\\Enums\\FileTypeEnum';
	$MediaOrientationEnum = 'WordPress\\AiClient\\Files\\Enums\\MediaOrientationEnum';
	$Candidate = 'WordPress\\AiClient\\Results\\DTO\\Candidate';
	$GenerativeAiResult = 'WordPress\\AiClient\\Results\\DTO\\GenerativeAiResult';
	$FinishReasonEnum = 'WordPress\\AiClient\\Results\\Enums\\FinishReasonEnum';
	$GenerativeAiOperation = 'WordPress\\AiClient\\Operations\\DTO\\GenerativeAiOperation';
	$OperationStateEnum = 'WordPress\\AiClient\\Operations\\Enums\\OperationStateEnum';

	$tokenUsage = new $TokenUsage(12, 8, 20, 2);
	$functionDeclaration = new $FunctionDeclaration(
		'lookup_weather',
		'Look up fixture weather.',
		array(
			'type' => 'object',
			'properties' => array(
				'city' => array('type' => 'string'),
				'units' => array('type' => 'string', 'enum' => array('metric', 'imperial')),
			),
			'required' => array('city'),
		)
	);
	$functionCall = new $FunctionCall('call-1', 'lookup_weather', array('city' => 'Portland', 'units' => 'metric'));
	$functionResponse = new $FunctionResponse('call-1', 'lookup_weather', array('temperature' => 18, 'ok' => true));
	$webSearch = new $WebSearch(array('example.com'), array('ads.example'));
	$fileRemote = new $File('https://example.com/assets/image.png', 'image/png');
	$fileInline = new $File(base64_encode('fixture text'), 'text/plain');
	$textPart = new $MessagePart('hello');
	$filePart = new $MessagePart($fileInline);
	$functionCallPart = new $MessagePart($functionCall, $MessagePartChannelEnum::content(), 'sig-model');
	$functionResponsePart = new $MessagePart($functionResponse);
	$userMessage = new $UserMessage(array($textPart, $filePart, $functionResponsePart));
	$modelMessage = new $ModelMessage(array(new $MessagePart('answer'), $functionCallPart));
	$supportedTemperature = new $SupportedOption($OptionEnum::temperature(), array(0.3, 0.7));
	$supportedInputModalities = new $SupportedOption($OptionEnum::inputModalities(), array(array('image', 'text'), array('text')));
	$requiredTemperature = new $RequiredOption($OptionEnum::temperature(), 0.7);
	$modelMetadata = new $ModelMetadata(
		'fixture-model',
		'Fixture Model',
		array($CapabilityEnum::textGeneration(), $CapabilityEnum::chatHistory()),
		array($supportedTemperature, $supportedInputModalities)
	);
	$modelRequirements = new $ModelRequirements(
		array($CapabilityEnum::textGeneration()),
		array($requiredTemperature)
	);
	$providerMetadata = new $ProviderMetadata(
		'fixture-provider',
		'Fixture Provider',
		$ProviderTypeEnum::cloud(),
		'https://example.com/credentials',
		$RequestAuthenticationMethod::apiKey(),
		'Fixture provider description.',
		'/wp-content/providers/fixture.svg'
	);
	$providerModelsMetadata = new $ProviderModelsMetadata($providerMetadata, array($modelMetadata));
	$requestOptions = $RequestOptions::fromArray(array('timeout' => 3.5, 'connectTimeout' => 1.25, 'maxRedirects' => 2));
	$request = new $Request(
		$HttpMethodEnum::POST(),
		'https://api.example.test/generate',
		array('Content-Type' => 'application/json', 'X-Fixture' => array('one', 'two')),
		array('prompt' => 'hello'),
		$requestOptions
	);
	$response = new $Response(200, array('Content-Type' => 'application/json'), '{"ok":true,"id":"result-1"}');
	$apiKeyAuthentication = new $ApiKeyRequestAuthentication('fixture-key');
	$authenticatedRequest = $apiKeyAuthentication->authenticateRequest($request);
	$modelConfig = new $ModelConfig();
	$modelConfig->setOutputModalities(array($ModalityEnum::text()));
	$modelConfig->setSystemInstruction('Be concise.');
	$modelConfig->setCandidateCount(2);
	$modelConfig->setMaxTokens(128);
	$modelConfig->setTemperature(0.7);
	$modelConfig->setTopP(0.9);
	$modelConfig->setTopK(40);
	$modelConfig->setStopSequences(array('END'));
	$modelConfig->setPresencePenalty(0.2);
	$modelConfig->setFrequencyPenalty(0.1);
	$modelConfig->setLogprobs(true);
	$modelConfig->setTopLogprobs(3);
	$modelConfig->setFunctionDeclarations(array($functionDeclaration));
	$modelConfig->setWebSearch($webSearch);
	$modelConfig->setOutputFileType($FileTypeEnum::inline());
	$modelConfig->setOutputMimeType('text/plain');
	$modelConfig->setOutputSchema(array('type' => 'object', 'properties' => array('summary' => array('type' => 'string'))));
	$modelConfig->setOutputMediaOrientation($MediaOrientationEnum::landscape());
	$modelConfig->setOutputMediaAspectRatio('16:9');
	$modelConfig->setOutputSpeechVoice('fixture-voice');
	$modelConfig->setCustomOption('provider_option', 'stable');
	$candidate = new $Candidate($modelMessage, $FinishReasonEnum::stop());
	$result = new $GenerativeAiResult(
		'result-1',
		array($candidate),
		$tokenUsage,
		$providerMetadata,
		$modelMetadata,
		array('trace' => 'fixture')
	);
	$operation = new $GenerativeAiOperation('operation-1', $OperationStateEnum::succeeded(), $result);

	$roundtrips = array(
		wphx_323_26_roundtrip('token_usage', $tokenUsage),
		wphx_323_26_roundtrip('function_declaration', $functionDeclaration),
		wphx_323_26_roundtrip('function_call', $functionCall),
		wphx_323_26_roundtrip('function_response', $functionResponse),
		wphx_323_26_roundtrip('web_search', $webSearch),
		wphx_323_26_roundtrip('file_remote', $fileRemote, null, array('isRemote' => $fileRemote->isRemote(), 'isImage' => $fileRemote->isImage())),
		wphx_323_26_roundtrip('file_inline', $fileInline, null, array('isInline' => $fileInline->isInline(), 'dataUri' => $fileInline->getDataUri())),
		wphx_323_26_roundtrip('message_part_text', $textPart),
		wphx_323_26_roundtrip('message_part_file', $filePart),
		wphx_323_26_roundtrip('message_part_function_call', $functionCallPart),
		wphx_323_26_roundtrip('message_part_function_response', $functionResponsePart),
		wphx_323_26_roundtrip('user_message_via_message', $userMessage, $Message),
		wphx_323_26_roundtrip('model_message_via_message', $modelMessage, $Message),
		wphx_323_26_roundtrip('provider_metadata', $providerMetadata),
		wphx_323_26_roundtrip('provider_models_metadata', $providerModelsMetadata),
		wphx_323_26_roundtrip('supported_option_temperature', $supportedTemperature),
		wphx_323_26_roundtrip('supported_option_input_modalities', $supportedInputModalities),
		wphx_323_26_roundtrip('required_option_temperature', $requiredTemperature),
		wphx_323_26_roundtrip('model_metadata', $modelMetadata),
		wphx_323_26_roundtrip('model_requirements', $modelRequirements, null, array('areMetByFixtureModel' => $modelRequirements->areMetBy($modelMetadata))),
		wphx_323_26_roundtrip('model_config', $modelConfig),
		wphx_323_26_roundtrip('request_options', $requestOptions, null, array('allowsRedirects' => $requestOptions->allowsRedirects())),
		wphx_323_26_roundtrip('request_post_json', $request, null, array('body' => $request->getBody(), 'headerContentType' => $request->getHeaderAsString('Content-Type'))),
		wphx_323_26_roundtrip('response_json', $response, null, array('isSuccessful' => $response->isSuccessful(), 'data' => $response->getData())),
		wphx_323_26_roundtrip('api_key_request_authentication', $apiKeyAuthentication, null, array('authenticatedHeaders' => $authenticatedRequest->getHeaders())),
		wphx_323_26_roundtrip('candidate', $candidate),
		wphx_323_26_roundtrip('generative_ai_result', $result, null, array('toText' => $result->toText(), 'candidateCount' => $result->getCandidateCount(), 'texts' => $result->toTexts())),
		wphx_323_26_roundtrip('generative_ai_operation', $operation),
	);

	$exceptions = array(
		wphx_323_26_exception_case('provider_metadata_invalid_id', static fn() => new $ProviderMetadata('Bad Provider', 'Bad Provider', $ProviderTypeEnum::cloud())),
		wphx_323_26_exception_case('function_call_missing_id_and_name', static fn() => new $FunctionCall(null, null, null)),
		wphx_323_26_exception_case('user_message_cannot_contain_function_call', static fn() => new $Message($MessageRoleEnum::user(), array(new $MessagePart($functionCall)))),
		wphx_323_26_exception_case('candidate_requires_model_message', static fn() => new $Candidate(new $UserMessage(array(new $MessagePart('not model'))), $FinishReasonEnum::stop())),
		wphx_323_26_exception_case('token_usage_missing_required_key', static fn() => $TokenUsage::fromArray(array('promptTokens' => 1))),
		wphx_323_26_exception_case('file_missing_payload', static fn() => $File::fromArray(array('fileType' => 'inline', 'mimeType' => 'text/plain'))),
		wphx_323_26_exception_case('request_options_negative_timeout', static fn() => $RequestOptions::fromArray(array('timeout' => -1))),
		wphx_323_26_exception_case('enum_invalid_value', static fn() => $MessageRoleEnum::from('__wphx_invalid__')),
	);

	return array(
		'roundtrips' => $roundtrips,
		'exceptions' => $exceptions,
		'derivedBehavior' => array(
			'modelRequirementsAreMetByModelMetadata' => $modelRequirements->areMetBy($modelMetadata),
			'supportedTemperatureAcceptsSample' => $supportedTemperature->isSupportedValue(0.7),
			'supportedTemperatureRejectsSample' => $supportedTemperature->isSupportedValue(1.2),
			'supportedInputModalitiesOrderInsensitive' => $supportedInputModalities->isSupportedValue(array('text', 'image')),
			'requestBody' => $request->getBody(),
			'requestUri' => $request->getUri(),
			'responseData' => $response->getData(),
			'authenticatedAuthorizationHeader' => $authenticatedRequest->getHeaderAsString('Authorization'),
			'resultText' => $result->toText(),
			'operationState' => $operation->getState()->value,
		),
	);
}

$autoload = array();
foreach ($class_fixtures as $entry) {
	$fqn = $entry['fqn'];
	$autoload[] = array(
		'fqn' => $fqn,
		'path' => $entry['path'],
		'expectedKind' => $entry['kind'],
		'classExists' => class_exists($fqn),
		'interfaceExists' => interface_exists($fqn),
		'traitExists' => trait_exists($fqn),
		'namespaceStartsWithWordPressAiClient' => str_starts_with($fqn, 'WordPress\\AiClient\\'),
	);
}

$reflection = array_map('wphx_323_26_reflection_summary', $class_fixtures);
$schemas = array();
foreach ($reflection as $summary) {
	if ($summary['schemaSummary'] !== null) {
		$schemas[$summary['fqn']] = $summary['schemaSummary'];
	}
}

$enums = array();
foreach ($enum_samples as $sample) {
	$enums[] = wphx_323_26_enum_summary($sample[0], $sample[1]);
}

$fixtureGraph = wphx_323_26_build_fixture_graph();
$roundtripFailures = array_values(array_filter(
	$fixtureGraph['roundtrips'],
	static fn($roundtrip) => !$roundtrip['matches'] || !$roundtrip['isArrayShape']
));
$exceptionFailures = array_values(array_filter(
	$fixtureGraph['exceptions'],
	static fn($exception) => !$exception['thrown']
));

$result = array(
	'rootRole' => 'normalized-copied-php-ai-client-corpus-root',
	'autoload' => $autoload,
	'reflection' => $reflection,
	'schemas' => $schemas,
	'enums' => $enums,
	'roundtrips' => $fixtureGraph['roundtrips'],
	'exceptions' => $fixtureGraph['exceptions'],
	'derivedBehavior' => $fixtureGraph['derivedBehavior'],
	'counts' => array(
		'autoloadChecks' => count($autoload),
		'reflectionClasses' => count($reflection),
		'schemaSummaries' => count($schemas),
		'enumFixtures' => count($enums),
		'roundtripFixtures' => count($fixtureGraph['roundtrips']),
		'exceptionFixtures' => count($fixtureGraph['exceptions']),
		'roundtripFailures' => count($roundtripFailures),
		'exceptionFailures' => count($exceptionFailures),
	),
	'fixtureFailures' => array(
		'roundtrips' => $roundtripFailures,
		'exceptions' => $exceptionFailures,
	),
);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
`
  );
}

function runProbe(root) {
  return JSON.parse(command("php", [PROBE, root]));
}

function validateProbe(probe, label) {
  const missingAutoload = probe.autoload.filter(
    (entry) => !entry.classExists && !entry.interfaceExists && !entry.traitExists
  );
  const badNamespaces = probe.autoload.filter((entry) => !entry.namespaceStartsWithWordPressAiClient);
  if (missingAutoload.length > 0) {
    throw new Error(`${label} autoload failures: ${JSON.stringify(missingAutoload, null, 2)}`);
  }
  if (badNamespaces.length > 0) {
    throw new Error(`${label} namespace failures: ${JSON.stringify(badNamespaces, null, 2)}`);
  }
  if (probe.counts.roundtripFailures !== 0 || probe.counts.exceptionFailures !== 0) {
    throw new Error(`${label} fixture failures: ${JSON.stringify(probe.fixtureFailures, null, 2)}`);
  }
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGate = readJson(AI_TINYMCE_GATES);
  const phpAiClientSubBoundaries = readJson(PHP_AI_CLIENT_SUB_BOUNDARIES);
  const wrapperSurface = readJson(WORDPRESS_AI_WRAPPER_SURFACE);
  const wrapperGeneratedAdapter = readJson(WORDPRESS_AI_WRAPPER_GENERATED_ADAPTER);

  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  mirrorPackage(ORACLE_ROOT);
  mirrorPackage(CANDIDATE_ROOT);
  writeProbe();

  const phpAiClientFiles = listFiles(PHP_AI_CLIENT_ROOT);
  const phpFiles = phpAiClientFiles.filter((path) => path.endsWith(".php"));
  if (phpFiles.length !== EXPECTED_PHP_FILE_COUNT) {
    throw new Error(`Unexpected php-ai-client PHP file count: expected ${EXPECTED_PHP_FILE_COUNT}, got ${phpFiles.length}`);
  }

  const packageDiff = packageDiffs(ORACLE_ROOT, CANDIDATE_ROOT);
  if (packageDiff.length > 0) {
    throw new Error(`Copied oracle and candidate php-ai-client package diverged: ${JSON.stringify(packageDiff, null, 2)}`);
  }

  const candidateLint = lintFiles(phpFiles.map(sourceToDistribution), CANDIDATE_ROOT);
  const oracleLint = lintFiles(phpFiles.map(sourceToDistribution), ORACLE_ROOT);
  const lintFailures = [...candidateLint, ...oracleLint].filter((entry) => !entry.ok);
  if (lintFailures.length > 0) {
    throw new Error(`php-ai-client PHP lint failures: ${JSON.stringify(lintFailures, null, 2)}`);
  }

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  validateProbe(oracle, "oracle");
  validateProbe(candidate, "candidate");
  const observationsMatch = JSON.stringify(stable(oracle)) === JSON.stringify(stable(candidate));
  if (!observationsMatch) {
    throw new Error("Oracle/candidate php-ai-client DTO schema corpus observations diverged");
  }

  const classFixtureCounts = countBy(PHP_AI_CLIENT_CLASS_FIXTURES, (entry) => entry.kind);
  const groupCounts = countBy(PHP_AI_CLIENT_CLASS_FIXTURES, (entry) => entry.group);
  const validationResult = {
    status: "passed",
    wordpress_oracle_locked_commit: wordpressCheckout.current_commit,
    php_ai_client_php_file_count: phpFiles.length,
    expected_php_ai_client_php_file_count: EXPECTED_PHP_FILE_COUNT,
    dto_schema_fixture_file_count: PHP_AI_CLIENT_CLASS_FIXTURES.length,
    dto_schema_fixture_counts_by_kind: classFixtureCounts,
    dto_schema_fixture_counts_by_group: groupCounts,
    enum_fixture_count: candidate.counts.enumFixtures,
    reflection_fixture_count: candidate.counts.reflectionClasses,
    schema_summary_count: candidate.counts.schemaSummaries,
    roundtrip_fixture_count: candidate.counts.roundtripFixtures,
    exception_fixture_count: candidate.counts.exceptionFixtures,
    autoload_check_count: candidate.counts.autoloadChecks,
    namespace_autoload_checks_pass: true,
    roundtrip_failures_empty: candidate.counts.roundtripFailures === 0,
    exception_failures_empty: candidate.counts.exceptionFailures === 0,
    oracle_candidate_package_diffs_empty: packageDiff.length === 0,
    oracle_candidate_observations_match: observationsMatch,
    candidate_php_lint_count: candidateLint.length,
    oracle_php_lint_count: oracleLint.length,
    candidate_php_lint_failures_empty: lintFailures.length === 0,
    generated_subset_receipt_present: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_public_php_replacement_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false
  };

  const sourceRecords = PHP_AI_CLIENT_CLASS_FIXTURES.map((entry) => ({
    ...entry,
    source: upstreamFileRecord(entry.path)
  }));

  const manifest = {
    schema: "wphx.wp-core.php-ai-client-dto-schema-corpus.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "php_ai_client_dto_schema_enum_roundtrip_reflection_corpus_gate",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_subset_receipt_present: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      php_ai_client_sub_boundaries_manifest: fileRecord(PHP_AI_CLIENT_SUB_BOUNDARIES),
      wordpress_ai_wrapper_surface_manifest: fileRecord(WORDPRESS_AI_WRAPPER_SURFACE),
      wordpress_ai_wrapper_generated_adapter_manifest: fileRecord(WORDPRESS_AI_WRAPPER_GENERATED_ADAPTER)
    },
    upstream_authority: wordpressCheckout,
    prior_gate_context: {
      ai_tinymce_gate: {
        issue: aiTinymceGate.issue,
        evidence_class: aiTinymceGate.evidence_class,
        haxe_owned_php_ai_client_runtime_claimed: aiTinymceGate.haxe_owned_php_ai_client_runtime_claimed
      },
      php_ai_client_sub_boundaries: {
        issue: phpAiClientSubBoundaries.issue,
        evidence_class: phpAiClientSubBoundaries.evidence_class,
        validation_result: phpAiClientSubBoundaries.validation_result
      },
      wordpress_ai_wrapper_surface: {
        issue: wrapperSurface.issue,
        evidence_class: wrapperSurface.evidence_class,
        haxe_owned_php_ai_client_runtime_claimed: wrapperSurface.haxe_owned_php_ai_client_runtime_claimed
      },
      wordpress_ai_wrapper_generated_adapter: {
        issue: wrapperGeneratedAdapter.issue,
        evidence_class: wrapperGeneratedAdapter.evidence_class,
        generated_public_php_replacement_claimed: wrapperGeneratedAdapter.generated_public_php_replacement_claimed,
        haxe_owned_php_ai_client_runtime_claimed: wrapperGeneratedAdapter.haxe_owned_php_ai_client_runtime_claimed
      }
    },
    copied_oracle_corpus: {
      source_root: PHP_AI_CLIENT_ROOT,
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT,
      php_file_count: phpFiles.length,
      package_hash: sha256(JSON.stringify(phpFiles.map((path) => upstreamFileRecord(path)))),
      package_diffs: packageDiff
    },
    namespace_autoload_checks: candidate.autoload,
    reflection_fixtures: candidate.reflection,
    schema_summaries: candidate.schemas,
    enum_fixtures: candidate.enums,
    roundtrip_fixtures: candidate.roundtrips,
    validation_exception_fixtures: candidate.exceptions,
    derived_behavior_fixtures: candidate.derivedBehavior,
    source_records: sourceRecords,
    subset_candidate_list: SUBSET_CANDIDATE_LIST,
    generated_subset_claim_requirements: [
      "A later gate must name the exact class/file subset and generate PHP at the original namespace/path or through an accepted WPHX PHP adapter route.",
      "The generated subset receipt must compare generated candidate behavior against this corpus and selected upstream PHPUnit/fake-provider fixtures.",
      "Reflection signatures, constructor defaults, static magic enum methods, namespace/autoload behavior, toArray/fromArray/jsonSerialize/schema behavior, and validation exceptions must match for the claimed subset.",
      "Provider registry, live provider, transport, discovery, credential, privacy, and shaded dependency behavior remain out of scope until their dedicated gates pass."
    ],
    validation_result: validationResult,
    claims: [
      "A deterministic php-ai-client DTO/schema/enum corpus now executes against copied oracle and copied candidate roots.",
      "The corpus records namespace/autoload checks, reflection summaries, enum singleton/static-magic behavior, DTO/schema roundtrips, validation exceptions, and subset candidates.",
      "The corpus is a prerequisite fixture floor for future generated Haxe/WPHX PHP php-ai-client subset claims."
    ],
    non_claims: NON_CLAIMS
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-26-php-ai-client-dto-schema-corpus",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "executable_corpus_gate",
      name: "php-ai-client DTO/schema/enum corpus gate",
      area: "wp-includes/php-ai-client/src DTO, enum, schema, message, result, tool, provider model, and HTTP DTO surfaces",
      public_contract:
        "Copied oracle php-ai-client package remains preserved bundled-library support while this gate records executable DTO/schema behavior for later generated subset work."
    },
    ownership_state: "preserved_bundled_library_fixture_gate",
    bridge: {
      exists: true,
      kind: "copied-oracle-corpus-for-future-generated-subset",
      removal_gate:
        "Replace only after a generated php-ai-client subset receipt exists, names the exact subset, passes this corpus and follow-up provider/transport gates where relevant, and records an ownership-state transition."
    },
    behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_subset_receipt_present: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    preserved_paths: [PHP_AI_CLIENT_ROOT],
    subset_candidate_list: SUBSET_CANDIDATE_LIST,
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-php-ai-client-dto-schema-corpus",
        "npm run wp:core:wphx-323-php-ai-client-dto-schema-corpus:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-26-php-ai-client-dto-schema-corpus"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-26-php-ai-client-dto-schema-corpus",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-php-ai-client-dto-schema-corpus",
    commands: [
      "npm run wp:core:wphx-323-php-ai-client-dto-schema-corpus",
      "npm run wp:core:wphx-323-php-ai-client-dto-schema-corpus:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      php_ai_client_sub_boundaries_manifest: PHP_AI_CLIENT_SUB_BOUNDARIES,
      wordpress_ai_wrapper_surface_manifest: WORDPRESS_AI_WRAPPER_SURFACE,
      wordpress_ai_wrapper_generated_adapter_manifest: WORDPRESS_AI_WRAPPER_GENERATED_ADAPTER
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  return manifest;
}

try {
  const manifest = main();
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: checkOnly,
        manifest: OUT,
        receipt: RECEIPT,
        php_file_count: manifest.validation_result.php_ai_client_php_file_count,
        roundtrip_fixture_count: manifest.validation_result.roundtrip_fixture_count,
        enum_fixture_count: manifest.validation_result.enum_fixture_count,
        reflection_fixture_count: manifest.validation_result.reflection_fixture_count,
        observations_match: manifest.validation_result.oracle_candidate_observations_match,
        generated_subset_receipt_present: manifest.validation_result.generated_subset_receipt_present,
        haxe_owned_php_ai_client_runtime_claimed:
          manifest.validation_result.haxe_owned_php_ai_client_runtime_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
