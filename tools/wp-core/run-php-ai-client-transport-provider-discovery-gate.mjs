#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.5",
  external_ref: "WPHX-323.27",
  title: "Add php-ai-client transport provider discovery gate"
};
const RECORDED_AT = "2026-07-08T23:55:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-php-ai-client-transport-provider-discovery-gate.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const PHP_AI_CLIENT_SUB_BOUNDARIES = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const PHP_AI_CLIENT_DTO_SCHEMA_CORPUS = "manifests/wp-core/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json";
const OUT = "manifests/wp-core/wphx-323-27-php-ai-client-transport-provider-discovery.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-27-php-ai-client-transport-provider-discovery.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-27-php-ai-client-transport-provider-discovery.v1.json";

const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const OUT_ROOT = "build/wp-core/wphx-323-27";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/php-ai-client-transport-provider-discovery-probe.php`;
const EXPECTED_PHP_FILE_COUNT = 146;

const PROVIDER_TRANSPORT_SOURCE_FIXTURES = [
  {
    path: "src/wp-includes/php-ai-client/src/Providers/ProviderRegistry.php",
    fqn: "WordPress\\AiClient\\Providers\\ProviderRegistry",
    group: "provider_registry",
    role: "provider registration, default auth, dependency injection, model discovery"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/AbstractProvider.php",
    fqn: "WordPress\\AiClient\\Providers\\AbstractProvider",
    group: "provider_registry",
    role: "static provider metadata, availability, model directory, and model creation cache"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/ApiBasedImplementation/AbstractApiProvider.php",
    fqn: "WordPress\\AiClient\\Providers\\ApiBasedImplementation\\AbstractApiProvider",
    group: "provider_registry",
    role: "API provider base URL joining"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/ApiBasedImplementation/AbstractApiBasedModel.php",
    fqn: "WordPress\\AiClient\\Providers\\ApiBasedImplementation\\AbstractApiBasedModel",
    group: "provider_model_runtime",
    role: "model metadata/config plus transport/auth dependencies"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/ApiBasedImplementation/AbstractApiBasedModelMetadataDirectory.php",
    fqn: "WordPress\\AiClient\\Providers\\ApiBasedImplementation\\AbstractApiBasedModelMetadataDirectory",
    group: "provider_model_runtime",
    role: "API-backed model metadata discovery and cache"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/OpenAiCompatibleImplementation/AbstractOpenAiCompatibleTextGenerationModel.php",
    fqn: "WordPress\\AiClient\\Providers\\OpenAiCompatibleImplementation\\AbstractOpenAiCompatibleTextGenerationModel",
    group: "provider_model_runtime",
    role: "OpenAI-compatible text generation request/response behavior"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Contracts/ProviderInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Contracts\\ProviderInterface",
    group: "provider_contract",
    role: "provider static API contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Contracts/ProviderAvailabilityInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Contracts\\ProviderAvailabilityInterface",
    group: "provider_contract",
    role: "provider availability contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Contracts/ModelMetadataDirectoryInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Contracts\\ModelMetadataDirectoryInterface",
    group: "provider_contract",
    role: "model metadata directory contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/Contracts/ModelInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\Contracts\\ModelInterface",
    group: "provider_contract",
    role: "model instance metadata/config contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/TextGeneration/Contracts/TextGenerationModelInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\TextGeneration\\Contracts\\TextGenerationModelInterface",
    group: "provider_contract",
    role: "text generation model behavior contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/DTO/ProviderMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\DTO\\ProviderMetadata",
    group: "provider_model_dto",
    role: "provider identity/auth metadata"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/DTO/ProviderModelsMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\DTO\\ProviderModelsMetadata",
    group: "provider_model_dto",
    role: "cross-provider model discovery result"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelConfig.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelConfig",
    group: "provider_model_dto",
    role: "model request configuration"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelMetadata.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelMetadata",
    group: "provider_model_dto",
    role: "model identity/capabilities/options"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Models/DTO/ModelRequirements.php",
    fqn: "WordPress\\AiClient\\Providers\\Models\\DTO\\ModelRequirements",
    group: "provider_model_dto",
    role: "model support matching"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Abstracts/AbstractClientDiscoveryStrategy.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Abstracts\\AbstractClientDiscoveryStrategy",
    group: "transport_discovery",
    role: "fake PSR-18/PSR-17 discovery strategy"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/HttpTransporter.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\HttpTransporter",
    group: "transport_discovery",
    role: "production HTTP transport conversion and exception mapping reference"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/HttpTransporterFactory.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\HttpTransporterFactory",
    group: "transport_discovery",
    role: "external discovery factory reference, not executed by this gate"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Contracts/HttpTransporterInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Contracts\\HttpTransporterInterface",
    group: "transport_discovery",
    role: "fake transport contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Contracts/RequestAuthenticationInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Contracts\\RequestAuthenticationInterface",
    group: "transport_discovery",
    role: "auth/header insertion contract"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Contracts/WithHttpTransporterInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Contracts\\WithHttpTransporterInterface",
    group: "transport_discovery",
    role: "transport injection marker"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Contracts/WithRequestAuthenticationInterface.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Contracts\\WithRequestAuthenticationInterface",
    group: "transport_discovery",
    role: "auth injection marker"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/ApiKeyRequestAuthentication.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication",
    group: "transport_discovery",
    role: "API key auth header behavior"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Request.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\Request",
    group: "transport_discovery",
    role: "HTTP request body/header/options behavior"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/RequestOptions.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions",
    group: "transport_discovery",
    role: "per-request timeout/redirect options"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Response.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\DTO\\Response",
    group: "transport_discovery",
    role: "HTTP response status/data behavior"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Util/ResponseUtil.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Util\\ResponseUtil",
    group: "exception_mapping",
    role: "HTTP status exception mapping"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Exception/ClientException.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Exception\\ClientException",
    group: "exception_mapping",
    role: "4xx exception mapping"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Exception/RedirectException.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Exception\\RedirectException",
    group: "exception_mapping",
    role: "3xx exception mapping"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Exception/ResponseException.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Exception\\ResponseException",
    group: "exception_mapping",
    role: "API response shape exception mapping"
  },
  {
    path: "src/wp-includes/php-ai-client/src/Providers/Http/Exception/ServerException.php",
    fqn: "WordPress\\AiClient\\Providers\\Http\\Exception\\ServerException",
    group: "exception_mapping",
    role: "5xx exception mapping"
  }
];

const NON_CLAIMS = [
  "This gate does not claim Haxe-owned wp-includes/php-ai-client/ runtime.",
  "This gate does not claim generated public PHP replacement for any wp-includes/php-ai-client/ file.",
  "This gate uses a fake provider, fake transport, and fake discovery strategy only; it does not execute live providers, live model APIs, network I/O, TLS, DNS, proxy, redirect, or external HTTPlug discovery.",
  "This gate does not claim credential storage safety, prompt/file privacy, provider data-retention policy, live authentication behavior, user consent behavior, or AI security policy closure.",
  "This gate does not claim installed WordPress AI behavior, plugin ecosystem compatibility, third-party dependency substitution, Composer replacement, shaded dependency retirement, or copied php-ai-client artifact retirement.",
  "This gate records provider/transport behavior as a preserved bundled-library fixture floor only; later generated subset ownership must pass this gate with explicit generated-source receipts."
];

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
declare(strict_types=1);

namespace {
	$root = rtrim($argv[1], '/\\');
	error_reporting(E_ALL);
	ini_set('display_errors', 'stderr');
	ini_set('log_errors', '0');

	require_once $root . '/wp-includes/php-ai-client/autoload.php';
}

namespace Wphx32327 {
	use Throwable;
	use WordPress\AiClient\Common\Exception\InvalidArgumentException;
	use WordPress\AiClient\Messages\DTO\MessagePart;
	use WordPress\AiClient\Messages\DTO\UserMessage;
	use WordPress\AiClient\Providers\AbstractProvider;
	use WordPress\AiClient\Providers\ApiBasedImplementation\AbstractApiBasedModel;
	use WordPress\AiClient\Providers\ApiBasedImplementation\AbstractApiBasedModelMetadataDirectory;
	use WordPress\AiClient\Providers\ApiBasedImplementation\AbstractApiProvider;
	use WordPress\AiClient\Providers\Contracts\ModelMetadataDirectoryInterface;
	use WordPress\AiClient\Providers\Contracts\ProviderAvailabilityInterface;
	use WordPress\AiClient\Providers\DTO\ProviderMetadata;
	use WordPress\AiClient\Providers\Enums\ProviderTypeEnum;
	use WordPress\AiClient\Providers\Http\Abstracts\AbstractClientDiscoveryStrategy;
	use WordPress\AiClient\Providers\Http\Contracts\HttpTransporterInterface;
	use WordPress\AiClient\Providers\Http\Contracts\RequestAuthenticationInterface;
	use WordPress\AiClient\Providers\Http\Contracts\WithHttpTransporterInterface;
	use WordPress\AiClient\Providers\Http\Contracts\WithRequestAuthenticationInterface;
	use WordPress\AiClient\Providers\Http\DTO\ApiKeyRequestAuthentication;
	use WordPress\AiClient\Providers\Http\DTO\Request;
	use WordPress\AiClient\Providers\Http\DTO\RequestOptions;
	use WordPress\AiClient\Providers\Http\DTO\Response;
	use WordPress\AiClient\Providers\Http\Enums\HttpMethodEnum;
	use WordPress\AiClient\Providers\Http\Enums\RequestAuthenticationMethod;
	use WordPress\AiClient\Providers\Http\Traits\WithHttpTransporterTrait;
	use WordPress\AiClient\Providers\Http\Traits\WithRequestAuthenticationTrait;
	use WordPress\AiClient\Providers\Http\Util\ResponseUtil;
	use WordPress\AiClient\Providers\Models\Contracts\ModelInterface;
	use WordPress\AiClient\Providers\Models\DTO\ModelConfig;
	use WordPress\AiClient\Providers\Models\DTO\ModelMetadata;
	use WordPress\AiClient\Providers\Models\DTO\ModelRequirements;
	use WordPress\AiClient\Providers\Models\DTO\RequiredOption;
	use WordPress\AiClient\Providers\Models\DTO\SupportedOption;
	use WordPress\AiClient\Providers\Models\Enums\CapabilityEnum;
	use WordPress\AiClient\Providers\Models\Enums\OptionEnum;
	use WordPress\AiClient\Providers\OpenAiCompatibleImplementation\AbstractOpenAiCompatibleTextGenerationModel;
	use WordPress\AiClient\Providers\ProviderRegistry;
	use WordPress\AiClientDependencies\Nyholm\Psr7\Factory\Psr17Factory;
	use WordPress\AiClientDependencies\Psr\Http\Client\ClientInterface;
	use WordPress\AiClientDependencies\Psr\Http\Message\RequestFactoryInterface;
	use WordPress\AiClientDependencies\Psr\Http\Message\RequestInterface as PsrRequestInterface;
	use WordPress\AiClientDependencies\Psr\Http\Message\ResponseInterface as PsrResponseInterface;

	function normalize($value) {
		if ($value instanceof \WordPress\AiClient\Common\AbstractEnum) {
			return $value->value;
		}
		if ($value instanceof \JsonSerializable) {
			return normalize($value->jsonSerialize());
		}
		if ($value instanceof \stdClass) {
			return array(
				'__stdClass' => true,
				'properties' => normalize((array) $value),
			);
		}
		if (is_array($value)) {
			$out = array();
			foreach ($value as $key => $item) {
				$out[$key] = normalize($item);
			}
			return $out;
		}
		if (is_object($value)) {
			return array(
				'__object' => get_class($value),
				'properties' => normalize(get_object_vars($value)),
			);
		}
		return $value;
	}

	function exception_case(string $id, callable $callback): array {
		try {
			$callback();
			return array(
				'id' => $id,
				'thrown' => false,
				'class' => null,
				'message' => null,
				'code' => null,
			);
		} catch (Throwable $e) {
			return array(
				'id' => $id,
				'thrown' => true,
				'class' => get_class($e),
				'message' => $e->getMessage(),
				'code' => $e->getCode(),
			);
		}
	}

	function model_ids(array $models): array {
		return array_values(array_map(static fn(ModelMetadata $metadata): string => $metadata->getId(), $models));
	}

	function provider_models_summary(array $providerModels): array {
		return array_values(array_map(
			static fn($entry): array => array(
				'providerId' => $entry->getProvider()->getId(),
				'modelIds' => model_ids($entry->getModels()),
			),
			$providerModels
		));
	}

	function fake_models_payload(): array {
		return array(
			'models' => array(
				array(
					'id' => 'fixture-text',
					'name' => 'Fixture Text',
					'supportedCapabilities' => array(
						CapabilityEnum::textGeneration()->value,
						CapabilityEnum::chatHistory()->value,
					),
					'supportedOptions' => array(
						array('name' => OptionEnum::temperature()->value, 'supportedValues' => array(0.2, 0.7)),
						array('name' => OptionEnum::maxTokens()->value),
						array('name' => OptionEnum::systemInstruction()->value),
						array('name' => OptionEnum::candidateCount()->value, 'supportedValues' => array(1)),
						array('name' => OptionEnum::outputMimeType()->value, 'supportedValues' => array('application/json')),
						array('name' => OptionEnum::outputSchema()->value),
						array('name' => OptionEnum::customOptions()->value),
						array('name' => OptionEnum::inputModalities()->value, 'supportedValues' => array(array('text'))),
					),
				),
				array(
					'id' => 'fixture-image',
					'name' => 'Fixture Image',
					'supportedCapabilities' => array(CapabilityEnum::imageGeneration()->value),
					'supportedOptions' => array(
						array('name' => OptionEnum::inputModalities()->value, 'supportedValues' => array(array('text'))),
					),
				),
			),
		);
	}

	final class FakeHttpTransporter implements HttpTransporterInterface {
		/** @var list<array<string, mixed>> */
		public array $requests = array();
		public ?Response $nextChatResponse = null;

		public function send(Request $request, ?RequestOptions $options = null): Response {
			$body = $request->getBody();
			$record = $request->toArray();
			$record['authorization'] = $request->getHeaderAsString('Authorization');
			$record['bodyData'] = $body !== null ? json_decode($body, true) : null;
			$record['parameterOptions'] = $options ? $options->toArray() : null;
			$this->requests[] = $record;

			$uri = $request->getUri();
			if (str_contains($uri, '/configured')) {
				return new Response(
					200,
					array('Content-Type' => 'application/json'),
					json_encode(array('configured' => true), JSON_THROW_ON_ERROR)
				);
			}
			if (str_contains($uri, '/models')) {
				return new Response(
					200,
					array('Content-Type' => 'application/json'),
					json_encode(fake_models_payload(), JSON_THROW_ON_ERROR)
				);
			}
			if (str_contains($uri, '/chat/completions')) {
				if ($this->nextChatResponse !== null) {
					$response = $this->nextChatResponse;
					$this->nextChatResponse = null;
					return $response;
				}
				return new Response(
					200,
					array('Content-Type' => 'application/json'),
					json_encode(
						array(
							'id' => 'chatcmpl-wphx-323-27',
							'choices' => array(
								array(
									'message' => array(
										'role' => 'assistant',
										'reasoning_content' => 'fixture reasoning trace',
										'content' => 'Generated fixture text',
										'tool_calls' => array(
											array(
												'type' => 'function',
												'id' => 'call-fixture-1',
												'function' => array(
													'name' => 'lookup_weather',
													'arguments' => '{"city":"Portland"}',
												),
											),
										),
									),
									'finish_reason' => 'tool_calls',
								),
							),
							'usage' => array(
								'prompt_tokens' => 5,
								'completion_tokens' => 7,
								'total_tokens' => 12,
							),
							'fixture_meta' => array(
								'transport' => 'fake',
								'provider' => FakeProvider::ID,
							),
						),
						JSON_THROW_ON_ERROR
					)
				);
			}
			return new Response(
				404,
				array('Content-Type' => 'application/json'),
				json_encode(array('error' => array('message' => 'unknown fake endpoint')), JSON_THROW_ON_ERROR)
			);
		}
	}

	final class FakeAvailability implements ProviderAvailabilityInterface, WithHttpTransporterInterface, WithRequestAuthenticationInterface {
		use WithHttpTransporterTrait;
		use WithRequestAuthenticationTrait;

		public static array $lastCheck = array();

		public function isConfigured(): bool {
			try {
				$request = new Request(
					HttpMethodEnum::GET(),
					FakeProvider::url('configured'),
					array('Accept' => 'application/json')
				);
				$request = $this->getRequestAuthentication()->authenticateRequest($request);
				$response = $this->getHttpTransporter()->send($request);
				self::$lastCheck = array(
					'statusCode' => $response->getStatusCode(),
					'authorization' => $request->getHeaderAsString('Authorization'),
				);
				return $response->isSuccessful();
			} catch (Throwable $e) {
				self::$lastCheck = array(
					'exceptionClass' => get_class($e),
					'exceptionMessage' => $e->getMessage(),
				);
				return false;
			}
		}
	}

	final class FakeMetadataDirectory extends AbstractApiBasedModelMetadataDirectory {
		public static int $listRequests = 0;

		protected function sendListModelsRequest(): array {
			self::$listRequests++;
			$request = new Request(
				HttpMethodEnum::GET(),
				FakeProvider::url('models'),
				array('Accept' => 'application/json')
			);
			$request = $this->getRequestAuthentication()->authenticateRequest($request);
			$response = $this->getHttpTransporter()->send($request);
			ResponseUtil::throwIfNotSuccessful($response);

			$data = $response->getData();
			if (!isset($data['models']) || !is_array($data['models'])) {
				throw \WordPress\AiClient\Providers\Http\Exception\ResponseException::fromMissingData(
					FakeProvider::metadata()->getName(),
					'models'
				);
			}

			$models = array();
			foreach ($data['models'] as $modelData) {
				$options = array();
				foreach ($modelData['supportedOptions'] as $optionData) {
					$options[] = new SupportedOption(
						OptionEnum::from($optionData['name']),
						$optionData['supportedValues'] ?? null
					);
				}
				$metadata = new ModelMetadata(
					$modelData['id'],
					$modelData['name'],
					array_map(static fn(string $capability): CapabilityEnum => CapabilityEnum::from($capability), $modelData['supportedCapabilities']),
					$options
				);
				$models[$metadata->getId()] = $metadata;
			}
			return $models;
		}
	}

	final class FakeTextGenerationModel extends AbstractOpenAiCompatibleTextGenerationModel {
		protected function createRequest(HttpMethodEnum $method, string $path, array $headers = array(), $data = null): Request {
			return new Request($method, FakeProvider::url($path), $headers, $data, $this->getRequestOptions());
		}
	}

	final class FakeGenericModel extends AbstractApiBasedModel {
	}

	final class FakeProvider extends AbstractApiProvider {
		public const ID = 'wphx-fixture-provider';

		protected static function baseUrl(): string {
			return 'https://fixture.provider.test/v1';
		}

		protected static function createModel(ModelMetadata $modelMetadata, ProviderMetadata $providerMetadata): ModelInterface {
			if ($modelMetadata->getId() === 'fixture-text') {
				return new FakeTextGenerationModel($modelMetadata, $providerMetadata);
			}
			return new FakeGenericModel($modelMetadata, $providerMetadata);
		}

		protected static function createProviderMetadata(): ProviderMetadata {
			return new ProviderMetadata(
				self::ID,
				'WPHX Fixture Provider',
				ProviderTypeEnum::cloud(),
				'https://fixture.provider.test/keys',
				RequestAuthenticationMethod::apiKey(),
				'Fake provider for WPHX-323.27 copied-oracle fixture execution.',
				null
			);
		}

		protected static function createProviderAvailability(): ProviderAvailabilityInterface {
			return new FakeAvailability();
		}

		protected static function createModelMetadataDirectory(): ModelMetadataDirectoryInterface {
			return new FakeMetadataDirectory();
		}
	}

	final class NoAuthAvailability implements ProviderAvailabilityInterface {
		public function isConfigured(): bool {
			return true;
		}
	}

	final class NoAuthDirectory implements ModelMetadataDirectoryInterface {
		public function listModelMetadata(): array {
			return array();
		}

		public function hasModelMetadata(string $modelId): bool {
			return false;
		}

		public function getModelMetadata(string $modelId): ModelMetadata {
			throw new InvalidArgumentException('No model with ID ' . $modelId . ' was found in the provider');
		}
	}

	final class NoAuthProvider extends AbstractProvider {
		public const ID = 'wphx-no-auth-provider';

		protected static function createModel(ModelMetadata $modelMetadata, ProviderMetadata $providerMetadata): ModelInterface {
			throw new InvalidArgumentException('NoAuthProvider does not create models in this fixture.');
		}

		protected static function createProviderMetadata(): ProviderMetadata {
			return new ProviderMetadata(
				self::ID,
				'WPHX No Auth Provider',
				ProviderTypeEnum::server(),
				null,
				null
			);
		}

		protected static function createProviderAvailability(): ProviderAvailabilityInterface {
			return new NoAuthAvailability();
		}

		protected static function createModelMetadataDirectory(): ModelMetadataDirectoryInterface {
			return new NoAuthDirectory();
		}
	}

	final class WrongAuthentication implements RequestAuthenticationInterface {
		public function authenticateRequest(Request $request): Request {
			return $request->withHeader('X-WPHX-Wrong-Auth', '1');
		}

		public static function getJsonSchema(): array {
			return array(
				'type' => 'object',
				'properties' => array(),
			);
		}
	}

	final class FakePsrClient implements ClientInterface {
		private Psr17Factory $factory;

		public function __construct(Psr17Factory $factory) {
			$this->factory = $factory;
		}

		public function sendRequest(PsrRequestInterface $request): PsrResponseInterface {
			return $this->factory->createResponse(204)->withHeader('X-WPHX-Discovery', 'fake-client');
		}
	}

	final class FakeClientDiscoveryStrategy extends AbstractClientDiscoveryStrategy {
		protected static function createClient(Psr17Factory $psr17Factory): ClientInterface {
			return new FakePsrClient($psr17Factory);
		}
	}

	function latest_request_by_path(FakeHttpTransporter $transport, string $needle): ?array {
		$matches = array_values(array_filter(
			$transport->requests,
			static fn(array $request): bool => isset($request['uri']) && str_contains($request['uri'], $needle)
		));
		if (!$matches) {
			return null;
		}
		return $matches[count($matches) - 1];
	}

	function run_discovery_fixture(): array {
		$clientCandidates = FakeClientDiscoveryStrategy::getCandidates(ClientInterface::class);
		$clientFactory = $clientCandidates[0]['class'];
		$client = $clientFactory();
		$psr17Factory = new Psr17Factory();
		$response = $client->sendRequest($psr17Factory->createRequest('GET', 'https://fixture.discovery.test/probe'));
		$requestFactoryCandidates = FakeClientDiscoveryStrategy::getCandidates(RequestFactoryInterface::class);
		$unknownCandidates = FakeClientDiscoveryStrategy::getCandidates('Wphx\\UnknownDiscoveryType');

		return array(
			'clientCandidateCount' => count($clientCandidates),
			'clientClass' => get_class($client),
			'clientResponseStatus' => $response->getStatusCode(),
			'clientResponseHeader' => $response->getHeaderLine('X-WPHX-Discovery'),
			'requestFactoryCandidateCount' => count($requestFactoryCandidates),
			'requestFactoryClass' => $requestFactoryCandidates[0]['class'] ?? null,
			'unknownCandidateCount' => count($unknownCandidates),
		);
	}

	function run_probe(): array {
		putenv('WPHX_FIXTURE_PROVIDER_API_KEY=env-default-key');
		FakeMetadataDirectory::$listRequests = 0;
		FakeAvailability::$lastCheck = array();

		$transport = new FakeHttpTransporter();
		$registry = new ProviderRegistry();
		$registry->setHttpTransporter($transport);
		$registry->registerProvider(FakeProvider::class);

		$auth = $registry->getProviderRequestAuthentication(FakeProvider::ID);
		$configuredById = $registry->isProviderConfigured(FakeProvider::ID);
		$configuredByClass = $registry->isProviderConfigured(FakeProvider::class);
		$availabilityRequest = latest_request_by_path($transport, '/configured');

		$directory = FakeProvider::modelMetadataDirectory();
		$modelsFirst = $directory->listModelMetadata();
		$modelsSecond = $directory->listModelMetadata();

		$textRequirements = new ModelRequirements(
			array(CapabilityEnum::textGeneration()),
			array(
				new RequiredOption(OptionEnum::temperature(), 0.7),
				new RequiredOption(OptionEnum::inputModalities(), array('text')),
			)
		);
		$unsupportedRequirements = new ModelRequirements(
			array(CapabilityEnum::embeddingGeneration()),
			array()
		);
		$providerMatches = $registry->findProviderModelsMetadataForSupport(FakeProvider::ID, $textRequirements);
		$registryMatches = $registry->findModelsMetadataForSupport($textRequirements);
		$unsupportedMatches = $registry->findProviderModelsMetadataForSupport(FakeProvider::ID, $unsupportedRequirements);

		$config = new ModelConfig();
		$config->setSystemInstruction('System fixture.');
		$config->setCandidateCount(1);
		$config->setMaxTokens(64);
		$config->setTemperature(0.7);
		$config->setOutputMimeType('application/json');
		$config->setOutputSchema(array(
			'name' => 'fixture_schema',
			'schema' => array(
				'type' => 'object',
				'properties' => array(
					'answer' => array('type' => 'string'),
				),
				'required' => array('answer'),
			),
		));
		$config->setCustomOption('seed', 'wphx-323-27');

		$model = $registry->getProviderModel(FakeProvider::ID, 'fixture-text', $config);
		$requestOptions = RequestOptions::fromArray(array(
			'timeout' => 2.5,
			'connectTimeout' => 0.5,
			'maxRedirects' => 0,
		));
		if (method_exists($model, 'setRequestOptions')) {
			$model->setRequestOptions($requestOptions);
		}
		$result = $model->generateTextResult(array(
			new UserMessage(array(new MessagePart('Generate a fixture response.'))),
		));
		$generationRequest = latest_request_by_path($transport, '/chat/completions');

		$registry->setProviderRequestAuthentication(FakeProvider::ID, new ApiKeyRequestAuthentication('manual-key'));
		$configuredAfterManualAuth = $registry->isProviderConfigured(FakeProvider::class);
		$manualAvailabilityRequest = latest_request_by_path($transport, '/configured');
		$manualModel = $registry->getProviderModel(FakeProvider::class, 'fixture-text');

		$exceptions = array(
			exception_case('unregistered_provider_class_lookup', static fn() => $registry->getProviderClassName('missing-provider')),
			exception_case('invalid_provider_registration', static fn() => (new ProviderRegistry())->registerProvider(\stdClass::class)),
			exception_case('missing_model_lookup', static fn() => $registry->getProviderModel(FakeProvider::ID, 'missing-model')),
			exception_case('wrong_authentication_type', static fn() => $registry->setProviderRequestAuthentication(FakeProvider::ID, new WrongAuthentication())),
			exception_case('no_auth_provider_rejects_authentication', static function (): void {
				$noAuthRegistry = new ProviderRegistry();
				$noAuthRegistry->registerProvider(NoAuthProvider::class);
				$noAuthRegistry->setProviderRequestAuthentication(NoAuthProvider::ID, new ApiKeyRequestAuthentication('bad'));
			}),
			exception_case('redirect_exception_mapping', static fn() => ResponseUtil::throwIfNotSuccessful(new Response(302, array('Location' => 'https://fixture.provider.test/next')))),
			exception_case('client_exception_mapping', static fn() => ResponseUtil::throwIfNotSuccessful(new Response(401, array('Content-Type' => 'application/json'), '{"error":{"message":"bad key"}}'))),
			exception_case('server_exception_mapping', static fn() => ResponseUtil::throwIfNotSuccessful(new Response(503, array('Content-Type' => 'application/json'), '{"message":"retry later"}'))),
			exception_case('model_response_missing_choices', static function () use ($transport, $model): void {
				$transport->nextChatResponse = new Response(200, array('Content-Type' => 'application/json'), '{"id":"broken"}');
				$model->generateTextResult(array(new UserMessage(array(new MessagePart('Trigger bad response.')))));
			}),
		);
		$exceptionFailures = array_values(array_filter($exceptions, static fn(array $case): bool => !$case['thrown']));

		$discovery = run_discovery_fixture();
		$discoveryFailures = array_values(array_filter(
			array(
				$discovery['clientCandidateCount'] === 1,
				$discovery['clientResponseStatus'] === 204,
				$discovery['clientResponseHeader'] === 'fake-client',
				$discovery['requestFactoryCandidateCount'] === 1,
				$discovery['unknownCandidateCount'] === 0,
			),
			static fn(bool $passed): bool => !$passed
		));

		$authSummary = $auth instanceof ApiKeyRequestAuthentication
			? array('class' => get_class($auth), 'apiKey' => $auth->getApiKey())
			: array('class' => is_object($auth) ? get_class($auth) : null, 'apiKey' => null);
		$manualAuth = $manualModel instanceof WithRequestAuthenticationInterface
			? $manualModel->getRequestAuthentication()
			: null;

		$assertions = array(
			'registeredProviderIdRoundtrip' => $registry->getProviderClassName(FakeProvider::ID) === FakeProvider::class
				&& $registry->getProviderId(FakeProvider::class) === FakeProvider::ID,
			'registeredProviderChecksPass' => $registry->hasProvider(FakeProvider::ID)
				&& $registry->hasProvider(FakeProvider::class)
				&& !$registry->hasProvider('missing-provider'),
			'defaultAuthFromEnvironment' => $authSummary['apiKey'] === 'env-default-key',
			'availabilityConfiguredWithFakeTransport' => $configuredById && $configuredByClass && ($availabilityRequest['authorization'] ?? null) === 'Bearer env-default-key',
			'metadataDiscoveryCached' => FakeMetadataDirectory::$listRequests === 1 && count($modelsFirst) === 2 && count($modelsSecond) === 2,
			'modelSupportDiscoveryMatchesTextModel' => model_ids($providerMatches) === array('fixture-text')
				&& provider_models_summary($registryMatches) === array(array('providerId' => FakeProvider::ID, 'modelIds' => array('fixture-text'))),
			'unsupportedRequirementsReturnEmpty' => $unsupportedMatches === array(),
			'modelDependenciesInjected' => $model instanceof WithHttpTransporterInterface
				&& $model->getHttpTransporter() === $transport
				&& $model instanceof WithRequestAuthenticationInterface
				&& $model->getRequestAuthentication() instanceof ApiKeyRequestAuthentication,
			'generationRequestUsesFakeTransportAuthAndOptions' => ($generationRequest['authorization'] ?? null) === 'Bearer env-default-key'
				&& ($generationRequest['method'] ?? null) === 'POST'
				&& ($generationRequest['options']['timeout'] ?? null) === 2.5
				&& ($generationRequest['options']['connectTimeout'] ?? null) === 0.5
				&& ($generationRequest['options']['maxRedirects'] ?? null) === 0,
			'generationBodyCarriesConfig' => ($generationRequest['bodyData']['model'] ?? null) === 'fixture-text'
				&& ($generationRequest['bodyData']['temperature'] ?? null) === 0.7
				&& ($generationRequest['bodyData']['max_tokens'] ?? null) === 64
				&& ($generationRequest['bodyData']['n'] ?? null) === 1
				&& ($generationRequest['bodyData']['seed'] ?? null) === 'wphx-323-27'
				&& ($generationRequest['bodyData']['response_format']['type'] ?? null) === 'json_schema',
			'generationResultParsed' => $result->getId() === 'chatcmpl-wphx-323-27'
				&& $result->toText() === 'Generated fixture text'
				&& $result->getTokenUsage()->getTotalTokens() === 12
				&& ($result->getAdditionalData()['fixture_meta']['transport'] ?? null) === 'fake',
			'manualAuthReinjected' => $configuredAfterManualAuth
				&& ($manualAvailabilityRequest['authorization'] ?? null) === 'Bearer manual-key'
				&& $manualAuth instanceof ApiKeyRequestAuthentication
				&& $manualAuth->getApiKey() === 'manual-key',
			'exceptionFixturesThrown' => count($exceptionFailures) === 0,
			'fakeDiscoveryOnlyPasses' => count($discoveryFailures) === 0,
		);
		$assertionFailures = array_keys(array_filter($assertions, static fn($passed): bool => $passed !== true && $passed !== false));
		$failedAssertions = array_keys(array_filter($assertions, static fn($passed): bool => $passed !== true));

		return array(
			'rootRole' => 'normalized-copied-php-ai-client-provider-transport-root',
			'registry' => array(
				'registeredProviderIds' => $registry->getRegisteredProviderIds(),
				'providerClassForId' => $registry->getProviderClassName(FakeProvider::ID),
				'providerIdForClass' => $registry->getProviderId(FakeProvider::class),
				'hasProviderById' => $registry->hasProvider(FakeProvider::ID),
				'hasProviderByClass' => $registry->hasProvider(FakeProvider::class),
				'hasMissingProvider' => $registry->hasProvider('missing-provider'),
				'isConfiguredById' => $configuredById,
				'isConfiguredByClass' => $configuredByClass,
				'isConfiguredAfterManualAuth' => $configuredAfterManualAuth,
				'defaultAuth' => $authSummary,
				'manualAuthClass' => $manualAuth ? get_class($manualAuth) : null,
			),
			'metadataDiscovery' => array(
				'modelIdsFirst' => model_ids($modelsFirst),
				'modelIdsSecond' => model_ids($modelsSecond),
				'sendListModelsRequestCount' => FakeMetadataDirectory::$listRequests,
				'directoryHasFixtureText' => $directory->hasModelMetadata('fixture-text'),
				'directoryHasMissing' => $directory->hasModelMetadata('missing-model'),
				'providerMatchIds' => model_ids($providerMatches),
				'registryMatches' => provider_models_summary($registryMatches),
				'unsupportedMatchIds' => model_ids($unsupportedMatches),
			),
			'transport' => array(
				'requests' => $transport->requests,
				'availabilityRequest' => $availabilityRequest,
				'manualAvailabilityRequest' => $manualAvailabilityRequest,
				'generationRequest' => $generationRequest,
				'lastAvailabilityCheck' => FakeAvailability::$lastCheck,
			),
			'generation' => array(
				'result' => $result->toArray(),
				'text' => $result->toText(),
				'candidateCount' => $result->getCandidateCount(),
				'tokenUsage' => $result->getTokenUsage()->toArray(),
				'additionalData' => $result->getAdditionalData(),
				'requestBodyData' => $generationRequest['bodyData'] ?? null,
			),
			'fakeDiscovery' => $discovery,
			'exceptions' => $exceptions,
			'counts' => array(
				'registeredProviderCount' => count($registry->getRegisteredProviderIds()),
				'metadataModelCount' => count($modelsFirst),
				'providerLocalModelMatchCount' => count($providerMatches),
				'registryProviderMatchCount' => count($registryMatches),
				'fakeTransportRequestCount' => count($transport->requests),
				'metadataDiscoveryRequestCount' => FakeMetadataDirectory::$listRequests,
				'exceptionFixtures' => count($exceptions),
				'exceptionFailures' => count($exceptionFailures),
				'fakeDiscoveryClientCandidates' => $discovery['clientCandidateCount'],
				'fakeDiscoveryRequestFactoryCandidates' => $discovery['requestFactoryCandidateCount'],
				'fakeDiscoveryFailures' => count($discoveryFailures),
				'assertionFailures' => count($failedAssertions),
			),
			'assertions' => $assertions,
			'assertionFailures' => $failedAssertions,
			'assertionShapeFailures' => $assertionFailures,
			'nonClaims' => array(
				'liveProviderBehaviorClaimed' => false,
				'externalDiscoveryClaimed' => false,
				'networkIoClaimed' => false,
				'credentialPrivacySecurityClaimed' => false,
			),
		);
	}
}

namespace {
	echo json_encode(
		\Wphx32327\normalize(\Wphx32327\run_probe()),
		JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
	);
}
`
  );
}

function runProbe(root) {
  return JSON.parse(command("php", [PROBE, root]));
}

function validateProbe(probe, label) {
  if (probe.counts.exceptionFailures !== 0 || probe.counts.fakeDiscoveryFailures !== 0 || probe.counts.assertionFailures !== 0) {
    throw new Error(`${label} provider/transport fixture failures: ${JSON.stringify({
      exceptions: probe.exceptions,
      fakeDiscovery: probe.fakeDiscovery,
      assertionFailures: probe.assertionFailures
    }, null, 2)}`);
  }
  if (probe.counts.registeredProviderCount !== 1) {
    throw new Error(`${label} registered provider count changed: ${probe.counts.registeredProviderCount}`);
  }
  if (probe.counts.metadataModelCount !== 2 || probe.counts.providerLocalModelMatchCount !== 1) {
    throw new Error(`${label} model discovery counts changed: ${JSON.stringify(probe.counts, null, 2)}`);
  }
  if (probe.nonClaims.liveProviderBehaviorClaimed || probe.nonClaims.externalDiscoveryClaimed) {
    throw new Error(`${label} attempted to claim live provider or external discovery behavior`);
  }
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGate = readJson(AI_TINYMCE_GATES);
  const phpAiClientSubBoundaries = readJson(PHP_AI_CLIENT_SUB_BOUNDARIES);
  const dtoSchemaCorpus = readJson(PHP_AI_CLIENT_DTO_SCHEMA_CORPUS);

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
    throw new Error("Oracle/candidate php-ai-client provider/transport observations diverged");
  }

  const sourceRecords = PROVIDER_TRANSPORT_SOURCE_FIXTURES.map((entry) => ({
    ...entry,
    source: upstreamFileRecord(entry.path)
  }));
  const validationResult = {
    status: "passed",
    wordpress_oracle_locked_commit: wordpressCheckout.current_commit,
    php_ai_client_php_file_count: phpFiles.length,
    expected_php_ai_client_php_file_count: EXPECTED_PHP_FILE_COUNT,
    provider_transport_source_fixture_count: PROVIDER_TRANSPORT_SOURCE_FIXTURES.length,
    provider_transport_source_fixture_counts_by_group: countBy(PROVIDER_TRANSPORT_SOURCE_FIXTURES, (entry) => entry.group),
    registered_provider_count: candidate.counts.registeredProviderCount,
    metadata_model_count: candidate.counts.metadataModelCount,
    provider_local_model_match_count: candidate.counts.providerLocalModelMatchCount,
    registry_provider_match_count: candidate.counts.registryProviderMatchCount,
    fake_transport_request_count: candidate.counts.fakeTransportRequestCount,
    metadata_discovery_request_count: candidate.counts.metadataDiscoveryRequestCount,
    exception_fixture_count: candidate.counts.exceptionFixtures,
    exception_failures_empty: candidate.counts.exceptionFailures === 0,
    fake_discovery_client_candidate_count: candidate.counts.fakeDiscoveryClientCandidates,
    fake_discovery_request_factory_candidate_count: candidate.counts.fakeDiscoveryRequestFactoryCandidates,
    fake_discovery_failures_empty: candidate.counts.fakeDiscoveryFailures === 0,
    assertion_failures_empty: candidate.counts.assertionFailures === 0,
    oracle_candidate_package_diffs_empty: packageDiff.length === 0,
    oracle_candidate_observations_match: observationsMatch,
    candidate_php_lint_count: candidateLint.length,
    oracle_php_lint_count: oracleLint.length,
    candidate_php_lint_failures_empty: lintFailures.length === 0,
    fake_provider_fixture_only: true,
    fake_transport_fixture_only: true,
    fake_discovery_fixture_only: true,
    live_provider_behavior_claimed: false,
    external_discovery_claimed: false,
    network_io_claimed: false,
    credential_privacy_security_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_public_php_replacement_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.php-ai-client-transport-provider-discovery.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "php_ai_client_fake_provider_transport_discovery_fixture_gate",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    external_discovery_claimed: false,
    network_io_claimed: false,
    credential_privacy_security_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      php_ai_client_sub_boundaries_manifest: fileRecord(PHP_AI_CLIENT_SUB_BOUNDARIES),
      php_ai_client_dto_schema_corpus_manifest: fileRecord(PHP_AI_CLIENT_DTO_SCHEMA_CORPUS)
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
      php_ai_client_dto_schema_corpus: {
        issue: dtoSchemaCorpus.issue,
        evidence_class: dtoSchemaCorpus.evidence_class,
        validation_result: dtoSchemaCorpus.validation_result
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
    fixture_design: {
      provider: "Wphx32327\\FakeProvider",
      provider_id: "wphx-fixture-provider",
      transport: "Wphx32327\\FakeHttpTransporter",
      discovery_strategy: "Wphx32327\\FakeClientDiscoveryStrategy",
      auth: "WordPress\\AiClient\\Providers\\Http\\DTO\\ApiKeyRequestAuthentication",
      models: ["fixture-text", "fixture-image"],
      live_provider_behavior: "non_claim",
      external_discovery_behavior: "non_claim",
      credential_privacy_security_policy: "non_claim"
    },
    provider_registry_observations: candidate.registry,
    metadata_discovery_observations: candidate.metadataDiscovery,
    fake_transport_observations: candidate.transport,
    generation_observations: candidate.generation,
    fake_discovery_observations: candidate.fakeDiscovery,
    exception_mapping_fixtures: candidate.exceptions,
    assertion_results: candidate.assertions,
    source_records: sourceRecords,
    generated_subset_claim_requirements: [
      "A later generated subset must preserve provider registry ID/class resolution, default auth creation, dependency injection, metadata directory cache behavior, model support matching, text generation request/response parsing, and exception mapping.",
      "Generated transport/auth DTO ownership must continue to pass the WPHX-323.26 DTO/schema corpus and this fake provider/transport gate.",
      "Live provider, external discovery, network, privacy/security, credential handling, and installed WordPress behavior require separate gates before any claim can move beyond fake fixtures."
    ],
    validation_result: validationResult,
    claims: [
      "A deterministic php-ai-client fake provider/transport/discovery gate now executes against copied oracle and copied candidate roots.",
      "The gate records provider registry behavior, default API-key auth discovery from a fake environment variable, dependency injection into availability/directories/models, metadata discovery caching, model support matching, fake text generation request/response parsing, fake PSR discovery candidates, and exception mapping.",
      "The gate is a prerequisite fixture floor for future generated Haxe/WPHX PHP provider/model/transport subset claims."
    ],
    non_claims: NON_CLAIMS
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-27-php-ai-client-transport-provider-discovery",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "executable_corpus_gate",
      name: "php-ai-client fake provider/transport/discovery gate",
      area: "wp-includes/php-ai-client provider registry, model support, fake transport, fake discovery, auth, and HTTP exception mapping",
      public_contract:
        "Copied oracle php-ai-client package remains preserved bundled-library support while this gate records executable provider/transport behavior for later generated subset work."
    },
    ownership_state: "preserved_bundled_library_fixture_gate",
    bridge: {
      exists: true,
      kind: "copied-oracle-provider-transport-fixture-for-future-generated-subset",
      removal_gate:
        "Replace only after a generated php-ai-client provider/transport subset receipt exists, passes WPHX-323.26 plus this gate, preserves fake provider/transport/discovery behavior, and records an ownership-state transition. Live provider/privacy/security behavior remains separately gated."
    },
    behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    external_discovery_claimed: false,
    network_io_claimed: false,
    credential_privacy_security_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    preserved_paths: [PHP_AI_CLIENT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-php-ai-client-transport-provider-discovery",
        "npm run wp:core:wphx-323-php-ai-client-transport-provider-discovery:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-27-php-ai-client-transport-provider-discovery"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-27-php-ai-client-transport-provider-discovery",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-php-ai-client-fake-provider-transport-discovery",
    commands: [
      "npm run wp:core:wphx-323-php-ai-client-transport-provider-discovery",
      "npm run wp:core:wphx-323-php-ai-client-transport-provider-discovery:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      php_ai_client_sub_boundaries_manifest: PHP_AI_CLIENT_SUB_BOUNDARIES,
      php_ai_client_dto_schema_corpus_manifest: PHP_AI_CLIENT_DTO_SCHEMA_CORPUS
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
        registered_provider_count: manifest.validation_result.registered_provider_count,
        metadata_model_count: manifest.validation_result.metadata_model_count,
        fake_transport_request_count: manifest.validation_result.fake_transport_request_count,
        exception_fixture_count: manifest.validation_result.exception_fixture_count,
        observations_match: manifest.validation_result.oracle_candidate_observations_match,
        fake_provider_fixture_only: manifest.validation_result.fake_provider_fixture_only,
        live_provider_behavior_claimed: manifest.validation_result.live_provider_behavior_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
