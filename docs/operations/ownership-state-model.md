# Ownership State Model

WordPressHX is a complete porting program. A typed layer can start a slice, but it must not become the unexamined destination. Every inventoried source unit that participates in runtime behavior should eventually have an ownership manifest using `manifests/schemas/ownership-manifest.schema.json`.

## States

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

## Smell Fixes

Smell fixes are allowed when evidence protects the compatibility boundary.

Before parity, a smell fix must be marked `no_observable_change` and cite compatibility evidence such as upstream tests, differential fixtures, ABI manifests, generated-output snapshots, or oracle receipts. If a fix intentionally changes behavior, it needs an ADR and must be marked `adr_approved_behavior_change`.

After parity, refactors can be more aggressive internally, but the public WordPress/Gutenberg contract still needs receipts. A cleaner Haxe design is a reason to propose a change, not proof that behavior stayed compatible.

## Manifest Discipline

Ownership manifests are evidence, not decoration:

- Update the manifest when a source unit changes state.
- Keep generated paths separate from Haxe-owned source paths.
- Reference receipt paths instead of relying on chat history.
- Do not mark wrappers as Haxe-owned until executable dependency on the upstream runtime is gone or explicitly bounded by an approved exception.
