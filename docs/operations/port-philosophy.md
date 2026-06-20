# Port Philosophy

This is a complete porting program, not a typed wrapper layer over WordPress.

The long-term destination is Haxe-authored executable knowledge for WordPress/Gutenberg runtime logic, with generated PHP/TypeScript/JavaScript artifacts preserving the public ecosystem contracts. A typed compatibility layer is useful early, but only as scaffolding: it lets us inventory APIs, prove target semantics, generate ABI shells, run oracles, and move one vertical slice at a time.

## Bootstrap Layer vs. Destination

The initial typed layer should provide:

- exact public ABI facades;
- original-path shells;
- typed access to PHP globals, arrays, references, hooks, includes, and templates;
- generated package/export/script-handle metadata;
- differential test harnesses and receipts.

It should not become a permanent thin wrapper around upstream PHP/JS implementations. Each wrapped upstream behavior needs an ownership state: external oracle, temporary bridge, scaffolded Haxe, Haxe parity candidate, or verified Haxe-owned. The machine-readable version of this policy is `manifests/schemas/ownership-manifest.schema.json`; the operating rules are in `docs/operations/ownership-state-model.md`.

## Fixing Smells

We should fix design smells when the evidence says the smell is real and the compatibility boundary is protected.

Before parity, fixes are allowed when they:

- do not change observable WordPress/Gutenberg behavior;
- reduce porting risk or repeated mistakes;
- make unsupported constructs explicit;
- improve deterministic generation or testing;
- are guarded by upstream/differential tests.

After a subsystem reaches parity, refactor tasks may improve internal design more aggressively while preserving public behavior. The rule is not "copy WordPress forever"; it is "capture behavior first, then improve behind tested boundaries."

## Practical Rule

Start with typed compatibility surfaces where WordPress's dynamic contract is dangerous to translate blindly. Use those surfaces to replace runtime logic with Haxe-owned implementations in small verified slices. Do not stop at wrappers unless a task records an approved temporary exception with a removal gate.
