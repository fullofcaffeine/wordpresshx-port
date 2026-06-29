# Ownership State Model

WordPressHX is a complete porting program. A typed layer can start a slice, but it must not become the unexamined destination. Every inventoried source unit that participates in runtime behavior should eventually have an ownership manifest using `manifests/schemas/ownership-manifest.schema.json`.

## States

Ownership state is a summary, not the full compatibility claim. When a unit crosses public WordPress boundaries, record or infer separate axes for semantic ownership, adapter-contract ownership, emission strategy, execution provider, and evidence level. The weakest axis bounds the claim.

For example, a unit with Haxe-owned helper logic but an upstream-derived transformed PHP shell is a bridge or partial candidate, not fully Haxe-owned. Automation does not establish ownership; provenance and typed source authority do.

`external_oracle`

The unit is upstream-owned evidence only. We read it, hash it, test against it, or compare behavior to it, but do not claim a Haxe implementation yet.

`temporary_bridge`

The unit is a typed ABI shell, extern, raw template segment, runtime delegate, generated shell, or direct target escape that exists only to preserve behavior while the real Haxe implementation is not ready. This state requires a `bridge` block and a `removal_gate`.

`scaffolded_haxe`

The unit has Haxe-owned structure, names, types, or generated shells, but does not yet claim full behavioral parity.

`haxe_parity_candidate`

The unit has Haxe-authored runtime logic and enough oracle coverage to be tested as the candidate implementation, but parity receipts are not complete or stable enough to mark it verified.

`verified_haxe_owned`

The unit is implemented in Haxe, generated artifacts are reproducible, public behavior is protected by receipts, and remaining upstream code is evidence rather than executable dependency.

## Allowed Movement

Normal movement is:

```text
external_oracle -> temporary_bridge -> scaffolded_haxe -> haxe_parity_candidate -> verified_haxe_owned
```

A slice may skip `temporary_bridge` when direct Haxe implementation is safe. It may move backward when upstream drift, missing tests, compiler pressure, or parity failures invalidate the claim. Moving to `verified_haxe_owned` requires receipt-backed evidence, not just successful compilation.

## Temporary Bridges

Temporary bridges are acceptable when they reduce migration risk or preserve public contracts during a vertical slice. They are not acceptable as permanent wrapper claims.

Every `temporary_bridge` manifest must name:

- the bridge kind;
- why the bridge exists;
- the upstream behavior or public contract that bounds it;
- the Beads issue that owns removal;
- the condition that lets the bridge move to a Haxe-owned state.

If the removal condition is unknown, the work is not ready to close. File the discovery as a Beads issue instead.

## PHP Shell Retirement

WordPress-facing PHP shells need a more precise ladder than the generic ownership states because a shell can preserve ABI while Haxe owns only a helper behind it. Use these shell states in manifests, receipts, and progress notes whenever a public PHP file, method, function, template, include script, or class shell is part of the evidence.

`bridge_shell`

The public shell is copied, hand-authored, transformed from upstream, or patched by a runner. It may prove compatibility pressure and protect a fixture, but it is not Haxe-owned public PHP. Required evidence: upstream/source hashes, bridge reason, allowed claims, non-claims, removal owner, and replacement condition.

`generated_helper_with_temporary_shell`

Haxe owns a bounded helper decision or private implementation class, while a copied or JS-patched shell still owns public PHP topology. This state can support a Haxe parity candidate for the helper only. It cannot claim durable public PHP replacement. Required gate: promote the shell to `compiler_emitted_original_path_shell` or explicitly keep the public boundary external.

`compiler_emitted_original_path_shell`

The original-path public PHP file or symbol is emitted by WPHX PHP, a Haxe macro/linker plan, or an accepted backend/custom-target improvement. This can support public-shell evidence when paired with generated-shape snapshots, PHP lint, static/runtime ABI checks, behavior probes, unsupported-empty manifests, and receipts.

`durable_public_adapter`

The public adapter is generated from Haxe-owned semantics plus typed ABI/shell metadata and has receipts for the claimed boundary. This is symbol-, method-, script-, or bounded-file scoped unless the evidence explicitly covers every public declaration and file-level effect.

`whole_file_owned`

The entire original WordPress public file is owned by Haxe/WPHX inputs, including declarations, top-level side effects, include/require timing, globals, references, warnings, output buffering, return/exit behavior, stack traces/source maps, and installed distribution placement. This state requires packaged distribution and ecosystem-facing gates in addition to local PHP probes.

Copied, transformed, hand-authored, or JavaScript-patched shells can support `bridge_shell` and `generated_helper_with_temporary_shell` evidence only. A durable public PHP claim must cite `compiler_emitted_original_path_shell`, `durable_public_adapter`, `whole_file_owned`, or a documented backend/custom-target improvement with compiler-pressure evidence and an ADR. If a temporary shell would be reused for a second durable claim class, file a blocker and move the adapter into WPHX PHP or the accepted backend lane first.

## Smell Fixes

Smell fixes are allowed when evidence protects the compatibility boundary.

Before parity, a smell fix must be marked `no_observable_change` and cite compatibility evidence such as upstream tests, differential fixtures, ABI manifests, generated-output snapshots, or oracle receipts. If a fix intentionally changes behavior, it needs an ADR and must be marked `adr_approved_behavior_change`.

After parity, refactors can be more aggressive internally, but the public WordPress/Gutenberg contract still needs receipts. A cleaner Haxe design is a reason to propose a change, not proof that behavior stayed compatible.

## Manifest Discipline

Ownership manifests are evidence, not decoration:

- Update the manifest when a source unit changes state.
- Do not collapse semantic ownership, adapter-contract ownership, emission strategy, execution provider, and evidence level into one vague label.
- Keep generated paths separate from Haxe-owned source paths.
- Reference receipt paths instead of relying on chat history.
- Do not mark wrappers as Haxe-owned until executable dependency on the upstream runtime is gone or explicitly bounded by an approved exception.
