# Oracle Review Prompt: AI Provider Privacy, Security, And Provenance

Use this prompt when asking the oracle for a second-pass architecture/security review of ADR-018 before the first live-provider claim or dependency-divergence claim.

## Context

Repository: `wordpresshx`

Behavior oracles:

- WordPress 7.0 checkout: `../wordpress-develop`
- Gutenberg forward checkout: `../gutenberg`

Relevant policy and evidence:

- `docs/adr/ADR-018-ai-provider-privacy-security-provenance.md`
- `manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json`
- `manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json`
- `manifests/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json`
- `manifests/wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json`
- `manifests/wp-core/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json`
- `manifests/wp-core/wphx-323-27-php-ai-client-transport-provider-discovery.v1.json`
- `manifests/license-provenance.v1.json`

Current state:

- php-ai-client internals are preserved bundled-library artifacts.
- WordPress AI wrapper files are WordPress adapter/API surfaces.
- `wp-includes/ai-client.php` has a narrow generated WPHX PHP adapter for two global functions.
- DTO/schema and fake provider/transport/discovery gates execute without live network behavior.
- Live provider behavior, credential safety, prompt/file privacy, provider cassette safety, installed WordPress AI parity, and dependency substitution remain non-claims.

## Review Request

Please review ADR-018 as a security and architecture policy before this project permits live AI provider claims or php-ai-client dependency divergence.

Focus on:

1. Whether the credential handling rules are strong enough for local developer use, CI, receipts, manifests, Beads, cassettes, logs, and generated artifacts.
2. Whether the prompt/file privacy rules cover WordPress-specific data flows: user content, media uploads, database content, plugin/theme data, hooks, filters, tool calls, and ability callbacks.
3. Whether hook, log, cache, event, exception, and cassette leakage rules are specific enough to produce executable gates.
4. Whether the live-provider opt-in and offline replay/fake-provider fallback policy is sufficient.
5. Whether the license, notice, SBOM, source/version/hash, shaded namespace, and ecosystem-visibility requirements are sufficient before dependency substitution or unscoping.
6. Whether any required gates are missing before claiming live provider behavior.
7. Whether any required gates are missing before claiming dependency divergence or copied artifact retirement.
8. Whether the policy accidentally blocks useful fake-provider/generated-wrapper work that should remain allowed.

Please return:

- must-fix issues;
- should-fix issues;
- explicit non-blocking suggestions;
- any recommended Beads follow-up tasks;
- a final recommendation: accept, accept with changes, or reject.
