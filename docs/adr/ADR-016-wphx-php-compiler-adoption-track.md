# ADR-016: WPHX PHP Compiler Adoption Track

Status: Accepted

Date: 2026-07-02

## Context

ADR-015 kept WPHX PHP on a staged Adapter IR path and explicitly avoided claiming that the in-repo Reflaxe-based compiler was already a mature arbitrary-Haxe PHP backend. That was correct for the evidence at the time.

The project now has enough public WordPress PHP pressure to make one thing clear: waiting too long to adopt the custom compiler path creates its own cost. If new Core slices are shaped around stock Haxe PHP output, copied public shells, or runner patches, the project will accumulate migration debt in exactly the surface that plugins, themes, operators, reflection tooling, and stack traces see.

The desired direction is to start on the durable compiler path now, even if that slows broad Core porting temporarily.

## Decision

Adopt WPHX PHP now as the primary focus for WordPress PHP emission work.

This means:

- WPHX PHP is the default route for new public WordPress PHP files, public ABI shells, original-path emission, declaration timing, file-scope behavior, references, native arrays, globals, warnings, includes, templates, and plugin/theme-visible generated PHP quality.
- True PHP output gaps should move into WPHX PHP core IR, the WPHX PHP runtime/std strategy, or the WordPress compatibility profile instead of being hidden by stock-Haxe-PHP-shaped Haxe source or runner patching.
- Stock Haxe PHP remains available as a private implementation emitter and std/php behavior oracle, but it is now a bounded fallback, not the architecture the project should optimize around.
- If WPHX PHP grows beyond Adapter IR into broad expression lowering, runtime, stdlib, reflection, dynamic dispatch, or source/debug ownership, that is acceptable only through the compiler-usability gates below and a later backend-promotion ADR before full-backend claims.

This ADR does not say WPHX PHP is already complete. It changes the default focus: make the custom compiler usable first, then resume broad Core PHP porting in parallel once the compiler adoption gate says the foundation is strong enough.

## Usable Compiler Gates

The Beads epic `WPHX-COMP-PHP-USABLE` owns the first adoption gates:

1. `WPHX-COMP-PHP-GAP-INVENTORY` audits every remaining stock Haxe PHP dependency, copied shell, runner patch, profile-specific adapter body, generic lowering gap, and runtime/std/bootstrap dependency.
2. `WPHX-COMP-PHP-RUNTIME-STDLIB-STRATEGY` defines what WPHX PHP borrows or adapts from the stock Haxe PHP target and `std/php`, using `../haxe.compilerdev.reference/haxe` as the behavior oracle.
3. `WPHX-COMP-PHP-CORE-LOWERING-PILOT` promotes repeated adapter constructs into reusable PHP core IR rather than WordPress-only emitters.
4. `WPHX-COMP-PHP-WHOLE-FILE-PILOT` emits a small real WordPress public PHP file or file group through WPHX PHP without relying on stock Haxe PHP for the public file shape or copied shell bodies.
5. `WPHX-COMP-PHP-ADOPTION-CI` records the quality gate for returning to broad Core port work in parallel.

Until those gates move, the ready queue should prefer compiler-usability work over broad new Core PHP domains. Core slices can still proceed when they provide high-signal compiler pressure, but they should file or unblock WPHX PHP tasks instead of normalizing fallback output.

## Generated PHP Policy

Generated PHP quality remains a product surface. Do not accept generated public PHP that is noisy, misleading, unidiomatic, hard to debug, or reflection-hostile merely because it passes a small behavior probe.

When good Haxe source cannot emit acceptable PHP:

- add reusable WPHX PHP core IR or printer support;
- add a minimized runtime/std/compiler fixture;
- borrow or adapt stock Haxe PHP lowering where practical;
- keep WordPress-specific behavior named in the WordPress profile only when the ABI requires it;
- file backend-promotion work if the gap is no longer adapter-sized.

Avoid PHP strings, runner patches, or source contortions as a convenience path. They are allowed only as explicitly labeled scaffolding with receipts and removal gates.

## Oracle Review

This is a high-impact compiler strategy shift. It does not need to block the adoption track, but it should be reviewed before the project fully abandons stock Haxe PHP as the private implementation emitter or claims WPHX PHP as a mature full backend. Use [the compiler adoption oracle prompt](../operations/oracle-wphx-php-compiler-adoption-review.md) for that review.

## Consequences

- WPHX PHP compiler work becomes the near-term focus.
- Broad WordPress Core PHP domain work should resume in parallel only after the adoption CI gate records that the compiler is usable enough, or when a Core slice is explicitly chosen to drive a compiler gate.
- ADR-015 remains accurate for non-claims, but this ADR changes the default posture from "wait for backend-scale pressure" to "make the custom compiler usable before accumulating more Core migration debt."
- Progress claims must still distinguish compiler adoption, public PHP shape, Haxe-owned semantics, installed WordPress behavior, and full backend maturity.

## Non-Claims

This ADR does not claim:

- WPHX PHP is already a full arbitrary-Haxe PHP backend;
- stock Haxe PHP can be removed today;
- WordPress Core PHP is ported;
- installed WordPress distribution parity;
- broad Gutenberg/browser ownership;
- permission to reimplement Haxe stdlib/runtime behavior from scratch when stock target behavior can be reused or adapted.

## Supersession

This ADR amends ADR-015 by changing project focus and adoption timing. It does not supersede ADR-015's generated PHP quality bar or full-backend promotion criteria.
