# ADR-004: Haxe Semantic Authority And Native Provider Policy

Status: Accepted

Date: 2026-06-22

## Context

WordPressHX must preserve compatibility with unmodified WordPress PHP plugins, themes, and drop-ins while progressively moving first-party WordPress behavior into Haxe-owned source.

The architecture discussion raised a future possibility: Haxe-authored WordPress logic could eventually target Rust or another runtime while still keeping a PHP compatibility surface. GPT 5.5 Pro, recorded in project notes as the oracle, reviewed this direction and recommended a narrower current policy:

- now, build PHP-hosted, Haxe-authored WordPress;
- later, optionally delegate narrowly eligible pure internal kernels to Rust/native providers;
- do not make Rust-first WordPress or peer PHP/Rust adapters a current parity goal.

The reason is compatibility. Some WordPress behavior is inseparable from PHP execution semantics: references, globals, dynamic properties, conditional declarations, include/caller scope, output buffers, hooks, callbacks, reflection, backtraces, diagnostics, PHP resources, serialization, object identity, load order, and original file paths.

## Decision

WordPressHX will use this architecture:

```text
Haxe-owned WordPress semantic and compatibility model
  -> generated PHP compatibility adapter as the privileged host
  -> optional native providers only for narrowly eligible internal kernels
```

PHP is the privileged compatibility host because unmodified plugins and themes consume PHP runtime behavior. PHP and Rust are not symmetric adapters while PHP plugin compatibility is a requirement.

Rust/native delegation is a future research and optimization option, not a current parity goal. A future Rust provider may implement selected pure kernels behind generated adapters and PHP fallbacks, but it must not own PHP-visible request state.

## Ownership Axes

Do not collapse ownership into one state. Artifact records and future ownership manifests should distinguish at least:

- `semantic_owner`: who owns the WordPress behavior;
- `adapter_contract_owner`: who owns the PHP-visible ABI and effects contract;
- `emission_strategy`: how target code is produced;
- `execution_provider`: where the behavior executes;
- `compatibility_evidence`: what evidence supports the claim.

Example:

```yaml
semantic_owner: haxe
adapter_contract_owner: haxe_typed
emission_strategy: typed_adapter_ir
execution_provider: haxe_php
compatibility_evidence: installed_differential
```

An upstream-derived bridge should say so:

```yaml
semantic_owner: partial_haxe
adapter_contract_owner: upstream_derived_bridge
emission_strategy: source_transform
execution_provider: mixed
compatibility_evidence: bounded_differential
```

The second example must not be labeled fully Haxe-owned merely because the transformation is automated.

## PHP Adapter Policy

The PHP compatibility-adapter role is permanent for the WordPress distribution. Hand-written, exact-source-transformed, upstream-derived, or JavaScript-string PHP shell bodies are temporary migration mechanisms.

Durable public WordPress PHP files must be generated from Haxe-owned contracts:

- typed Haxe source;
- typed adapter metadata;
- Haxe macros;
- typed linker inputs;
- a constrained Adapter IR;
- or a generic backend/custom-target improvement accepted by ADR.

The generated adapter may be substantial and PHP-specific. It does not need to be a thin wrapper. Boundary-sensitive behavior may need direct PHP lowering in the original public body rather than a call through a private generated class, because wrapper calls can change backtraces, warning locations, reference behavior, reflection, caller scope, and output-buffer context.

## Emission Strategy

Use two complementary emitters:

| Need | Mechanism |
| --- | --- |
| Private namespaced implementation classes | Stock Haxe PHP target |
| Original WordPress files and public PHP ABI | Haxe-owned typed Adapter IR plus deterministic original-path emitter/linker |
| Generic defects in normal Haxe-to-PHP lowering | Improve the stock Haxe PHP backend |
| Optional pure internal native kernels | Generated narrow native-provider binding |
| Whole custom Haxe PHP target | Defer until compiler-pressure evidence proves it necessary |

The current original-path linker is an assembly mechanism. The durable version should consume typed adapter plans, not arbitrary production PHP strings.

## Native Provider Eligibility

A function or subsystem is eligible for Rust/native delegation only when all of these are true:

- inputs and outputs are scalars, byte strings, or immutable value trees;
- no PHP references cross the boundary;
- no PHP callbacks occur during the call;
- no reads or writes of PHP globals or superglobals occur;
- no public PHP object or resource identity crosses the boundary;
- no observable output, warning, declaration, include, or fatal occurs during the call;
- no dependence on caller scope or stack shape exists;
- locale, timezone, encoding, and regular-expression semantics are explicit;
- the call is coarse enough to amortize marshaling;
- a PHP implementation remains available as fallback;
- native-on and native-off runs are differentially equivalent.

Do not use JSON as the generic crossing format for arbitrary PHP values. It loses PHP distinctions around integer/string keys, aliases, objects, resources, binary strings, and false/null/error cases.

## Native Candidate Classes

Plausible future candidates are internal kernels, not public WordPress subsystems:

- block parser/tokenizer kernels;
- text diff algorithms;
- SQL or `dbDelta` lexical analysis;
- pure schema validation;
- selected path or formatting kernels;
- selected HTML tokenizer/parser internals after fuzz parity.

Keep PHP-hosted until much later:

- bootstrap and load order;
- includes, templates, pluggable declarations;
- hooks and plugin lifecycle;
- public callback dispatch;
- `wpdb`, database handles, results, and drop-ins;
- `WP_Query` public object state;
- options, object cache, and global cache/drop-in behavior;
- REST request dispatch and callbacks;
- filesystem, HTTP, media, and stream/resource APIs;
- cron callback execution;
- authentication/session state;
- any object commonly serialized or inspected by plugins.

## Compatibility Claims

Do not claim "Rust WordPress core" for optional native kernels.

The first honest native claim would be:

> WordPress remains PHP-hosted. Subsystem X is implemented by an optional Rust provider behind a generated adapter, with a PHP fallback. Native-on and native-off configurations pass the same versioned differential and plugin-corpus tests.

Any stronger "Rust-hosted, PHP-plugin-compatible" claim requires a separate ADR and evidence that a real PHP engine is hosted with complete request, extension, plugin, filesystem, output, diagnostic, reflection, and shutdown compatibility.

## Consequences

- Haxe owns both migrated behavior and adapter intent.
- Upstream WordPress is a locked behavioral oracle and temporary import source, not a durable generated-adapter source.
- Existing upstream-derived shell work must be classified as bridge evidence until public declarations and bodies are emitted from Haxe-owned adapter contracts.
- PHP-specific Haxe adapter code is allowed when it represents real PHP semantics. Do not force every line to be target-neutral.
- Provider-neutral interfaces should be introduced only when a demonstrated second provider exists.
- Rust/native work is deferred until PHP parity and boundary evidence are stronger.
- Future progress metrics and ownership manifests should distinguish semantic ownership from adapter-contract ownership and execution provider.

## Non-Goals

- Rust-first WordPress during PHP parity.
- Peer PHP and Rust adapters claiming ordinary PHP plugin compatibility.
- Reimplementing observable PHP runtime semantics in Rust.
- A whole custom Haxe PHP target without minimized evidence.
- Long-lived production PHP bodies embedded in JavaScript/MJS runners.

## Supersession

This ADR clarifies ADR-001. ADR-001 remains accepted for the PHP feasibility architecture, but any statement that generated shells themselves are permanent should be read as: the PHP compatibility-adapter role is permanent; upstream-derived or hand-written shell implementations are migration mechanisms.
