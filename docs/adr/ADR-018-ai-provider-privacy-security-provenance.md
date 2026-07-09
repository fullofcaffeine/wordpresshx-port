# ADR-018: AI Provider Privacy, Security, And Provenance Policy

Status: Accepted

Date: 2026-07-08

## Context

WPHX-323.07 split the WordPress 7.0 AI client work into preserved php-ai-client internals, WordPress AI wrapper adapter surfaces, executable DTO/schema and fake provider/transport fixtures, and a separate policy gate for live provider behavior and dependency divergence.

The existing AI gates deliberately do not claim live provider behavior, credential safety, prompt or file privacy, installed WordPress AI parity, plugin ecosystem compatibility, or dependency substitution for `WordPress\AiClientDependencies`. That is the right posture. Live AI provider work is different from ordinary local fixtures because it can send prompts, uploaded files, user data, hook-injected payloads, credentials, model metadata, cache values, and logs outside the local WordPress process.

This ADR defines the minimum privacy, security, cassette, and provenance policy before any future gate may claim live provider behavior or php-ai-client dependency divergence.

## Decision

Keep fake providers, fake transports, and copied preserved php-ai-client fixtures as the default evidence path. Live provider tests, credential-bearing tests, prompt/file payload tests, provider cassettes, or dependency divergence are opt-in exceptions with explicit receipts.

The policy applies to:

- `wp-includes/ai-client.php`;
- `wp-includes/ai-client/*`;
- `wp-includes/php-ai-client/`;
- `WordPress\AiClientDependencies`;
- provider discovery, transport, authentication, model-generation, prompt-builder, event, hook, cache, log, cassette, and file-upload paths;
- any future generated Haxe/WPHX PHP replacement that touches those paths.

## Credential Handling

Real provider credentials must never be committed, exported, copied into Beads, printed into receipts, written into manifests, included in cassettes, stored in build artifacts, recorded in screenshots, or represented by secret-derived hashes.

Live-provider gates may read credentials only from explicit local environment variables, with a separate opt-in variable such as `WPHX_AI_LIVE_PROVIDER_OPT_IN=1`. Normal precommit, pre-push, and default CI must run without live credentials and without network egress.

Receipts for live gates may record provider family, model family, region class, fixture name, and whether a required credential was present. They must not record credential values, partial values, hashes, account IDs, project IDs, organization IDs, bearer tokens, refresh tokens, signed URLs, or raw authorization headers.

Credential-bearing fixtures must use revocable, least-privilege, test-only provider credentials. The receipt must record the credential scope, rotation/deletion expectation, and the local-only setup document path, not the secret.

## Prompt And File Privacy

Synthetic prompts and synthetic files are the default. Live gates must not send real user content, database content, media-library files, uploads, plugin/theme files, site configuration, email addresses, names, IP addresses, cookies, nonces, or other personal data unless a later installed privacy/security gate records consent, minimization, retention, erasure, and user-visible behavior.

Prompt and file fixtures must classify every payload as synthetic, public fixture, redacted cassette, or installed-user data. Installed-user data is blocked for now.

Provider cassettes and receipts may store synthetic prompt/file bodies only when the data is generated for the fixture and has no personal or proprietary content. Otherwise they must redact prompt bodies, file bodies, filenames that reveal user data, embeddings, tool-call arguments, model outputs, and provider error bodies.

Future installed AI evidence must prove that prompt-builder hooks, provider filters, ability callbacks, uploaded-file handling, and tool calls do not bypass the privacy classification or send hidden WordPress data without an explicit fixture and consent policy.

## Hooks Logs And Cache Leakage

Every AI-facing hook, filter, event, log, cache, and exception boundary must be treated as a leakage boundary. Fixtures that claim safety must cover both normal and failure paths.

Logs, receipts, manifests, Beads comments, and cassette indexes may record fixture IDs, classes, route names, provider family, status codes, timing buckets, model family, and redacted payload shapes. They must not record raw credentials, authorization headers, cookies, nonces, raw prompts, raw uploaded files, personal data, raw provider responses, or cache values containing those payloads.

Cache keys and cache values must not contain raw credentials, authorization headers, raw prompts, raw files, personal data, provider account identifiers, or provider request IDs unless a specific installed privacy/security gate proves redaction and retention behavior. Cache evidence must record TTL, invalidation, namespace, and redaction policy.

Hook and event fixtures must prove that plugin-visible callbacks receive only the intended payload shape and that sensitive values are either absent or explicitly redacted before dispatch.

## Provider Cassettes And Live Opt-In

Fake transport remains the normal oracle. Live provider gates are disabled unless the local environment opts in and the gate name clearly indicates network behavior.

Provider cassettes are allowed only for explicitly approved live-provider gates. A cassette must include a redaction manifest, provider family, model family, date, fixture ID, request/response shape, and a statement that no credentials, personal data, raw user prompts, raw uploaded files, account identifiers, or secret-bearing headers are present.

Live gates must be replayable without network access using redacted cassettes or deterministic fake-provider fixtures. If a provider's terms forbid cassette storage or replay, the gate must remain local-only and must not become a required default CI gate.

Any live-provider claim must record provider terms/data-retention review, regional data handling where relevant, model-version drift policy, rate-limit/error behavior, TLS/proxy/DNS behavior, retry behavior, and a revalidation schedule.

## License SBOM And Dependency Provenance

The shaded `WordPress\AiClientDependencies` tree remains preserved exactly as bundled until a later dependency-divergence gate passes.

Dependency substitution, unscoping, deduplication, Composer replacement, package upgrade, generated replacement, or copied artifact retirement requires:

- exact package name, version, source URL or locked ref, artifact digest, license, notice files, and SBOM entry for every affected dependency family;
- GPL compatibility and WordPress distribution policy review;
- source and distribution path/hash mapping;
- scoped namespace collision review and plugin/ecosystem visibility scan;
- API/reflection snapshots for public and plugin-visible classes, interfaces, traits, constants, constructors, methods, parameter defaults, exceptions, and PSR surfaces;
- deterministic fake provider/transport/discovery/cache/event fixtures before live network fixtures;
- fallback policy for hosts lacking expected native extensions, Composer packages, or provider-specific clients;
- security-advisory and update-policy review;
- explicit Beads follow-up for any unresolved notice, license, SBOM, or compatibility gap.

## Claim Gates

A future gate may claim live provider behavior only after all of these are true:

1. WPHX-323.24, WPHX-323.26, WPHX-323.27, and this ADR have passed.
2. The gate is explicitly opt-in for network behavior and never runs in default precommit, pre-push, or default CI.
3. Real credentials come only from local environment variables and are never written to evidence.
4. The fixture uses synthetic or approved redacted payloads.
5. Hook, log, cache, event, exception, and cassette redaction checks pass.
6. Provider terms, retention, model drift, network, retry, TLS/proxy/DNS, and failure behavior are recorded.
7. Replay or fake-provider fallback evidence exists for default offline runs.
8. Secrets scanning passes after cassette or live-gate evidence changes.

A future gate may claim dependency divergence only after all of these are true:

1. WPHX-323.23, WPHX-323.26, WPHX-323.27, and this ADR have passed.
2. License, notice, SBOM, source, version, hash, and update-policy evidence is recorded for every affected dependency family.
3. API/reflection, fake transport/discovery/cache/event, fallback, and ecosystem visibility fixtures pass.
4. The divergence is accepted by a Beads issue or ADR that names whether the WordPress distribution is allowed to depend on external packages, generated replacements, or preserved fallbacks.
5. No shaded dependency artifact is retired until copied-artifact retirement evidence names the replacement and rollback path.

## Oracle Review

This ADR is high-impact because live AI provider behavior can exfiltrate user data and dependency divergence can change the WordPress distribution trust boundary. The project should request a second-pass architecture/security review from the oracle before the first live-provider claim or dependency-divergence claim. Use `docs/operations/oracle-ai-provider-privacy-security-provenance-review.md` as the reproducible prompt bundle.

The review is not required to keep fake-provider and preserved-library work moving. It is required before changing this policy in a way that weakens opt-in, credential, prompt/file, cassette, or dependency-divergence safeguards.

## Consequences

The current AI client work can keep progressing through fake-provider, DTO/schema, generated wrapper, and preserved-library gates without live credentials or network egress.

Future live-provider work must be treated as a privacy/security feature, not as a normal unit test. Evidence must be opt-in, redacted, replayable or fakeable, and explicit about what data crosses the provider boundary.

Future dependency work must treat the shaded dependency tree as a WordPress distribution boundary. Replacement is possible, but only with provenance, SBOM, API/reflection, compatibility, fallback, and rollback evidence.

## Non-Claims

This ADR does not claim:

- live provider behavior parity;
- credential handling safety has been proven by an executable live test;
- prompt/file privacy has been proven for installed WordPress data;
- provider cassette safety has been proven;
- installed WordPress AI behavior parity;
- Haxe-owned php-ai-client runtime logic;
- generated public PHP replacement for php-ai-client internals;
- dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for `WordPress\AiClientDependencies`;
- legal advice.

## Supersession

This ADR refines the AI-client non-claims in WPHX-323.07 and the follow-up gates WPHX-323.23 through WPHX-323.27. A later live-provider ADR or dependency-divergence ADR may narrow or extend this policy only with receipts, secrets scanning, redaction evidence, license/SBOM review, and oracle-review disposition.
