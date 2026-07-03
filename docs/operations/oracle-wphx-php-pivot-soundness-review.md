# Oracle Review Prompt: WPHX PHP Pivot Soundness

This prompt bundle is for the external architecture reviewer, referred to in project notes as **the oracle**. WordPress and Gutenberg remain the behavior oracles.

## Decision Under Review

Review whether the current WPHX PHP pivot remains architecturally sound after ADR-015, ADR-016, ADR-017, the usable-compiler gate, and the first post-pivot public WordPress slices.

Current direction:

- WPHX PHP uses Reflaxe infrastructure under `src/wphx/compiler/php`.
- WPHX PHP is the active staged custom compiler lane for WordPress-facing PHP output.
- Its admitted scope is still original-path public adapters, Adapter IR, reusable PHP core IR, bootstrap/runtime strategy, and bounded whole-file pilots.
- Stock Haxe PHP remains the private implementation emitter and std/php behavior oracle until a later backend-promotion ADR moves that responsibility.
- New public WordPress ABI and generated PHP quality gaps should move into WPHX PHP instead of source contortions, runner patches, copied public shells, or long-lived raw PHP strings.
- Full arbitrary-Haxe backend maturity, stock-target abandonment, or extracted `reflaxe.php` target scope still require backend-scale evidence, generated PHP quality gates, and a later ADR.

## Why This Checkpoint Exists

The project deliberately pivoted before broad Core translation because public WordPress PHP has requirements that stock Haxe PHP does not naturally satisfy: original file paths, include timing, reflection-visible declarations, native arrays, references, globals, conditional declarations, stack traces, readable generated code, mixed template behavior, and plugin/theme ecosystem expectations.

The risk is that the Adapter IR lane could either:

- stay too narrow and force source-level compromises or runner glue;
- grow into a WordPress-specific backend without admitting it;
- prematurely become a full `reflaxe.php` target before runtime/std/source-map/stdlib borrowing evidence is strong enough;
- keep stock Haxe PHP too long for private implementation output if that target becomes the quality bottleneck.

This review should test whether the current governance and evidence gates are strong enough for the long-term vision.

## Context To Provide

- `AGENTS.md`
- `docs/prd/wordpress-haxe-port.md`
- `docs/adr/ADR-001-php-emission-architecture.md`
- `docs/adr/ADR-013-wphx-php-adapter-ir-and-scope.md`
- `docs/adr/ADR-014-haxe-php-bootstrap-lifecycle.md`
- `docs/adr/ADR-015-wphx-php-backend-strategy.md`
- `docs/adr/ADR-016-wphx-php-compiler-adoption-track.md`
- `docs/adr/ADR-017-wphx-php-runtime-stdlib-strategy.md`
- `docs/operations/wphx-php-compiler.md`
- `docs/operations/progress-matrix.md`
- `docs/operations/oracle-original-path-php-emission-review.md`
- `docs/operations/oracle-wphx-php-backend-strategy-review.md`
- `docs/operations/oracle-wphx-php-compiler-adoption-review.md`

## Current Evidence To Provide

- `manifests/wphx-php/compiler-gap-inventory.v1.json`
- `manifests/ci/wphx-php-adoption-ci.v1.json`
- `manifests/wphx-php/public-shell-snapshots.v1.json`
- `manifests/wphx-php/runtime-stdlib-strategy.v1.json`
- `manifests/wphx-php/core-lowering-pilot.v1.json`
- `manifests/wphx-php/whole-file-class-http.v1.json`
- `manifests/wphx-php/feed-module-functions.v1.json`
- `manifests/wphx-php/embed-module-functions.v1.json`
- `manifests/wphx-php/https-module-functions.v1.json`
- `manifests/wphx-php/wp-embed-handlers.v1.json`
- `manifests/wphx-php/wp-oembed-providers.v1.json`
- `receipts/compiler/wphx-comp-php-gap-inventory.v1.json`
- `receipts/compiler/wphx-comp-php-adoption-ci.v1.json`
- `receipts/compiler/wphx-comp-php-public-shell-snapshots.v1.json`
- `receipts/compiler/wphx-comp-php-runtime-stdlib-strategy.v1.json`
- `receipts/compiler/wphx-comp-php-core-lowering-pilot.v1.json`
- `receipts/compiler/wphx-comp-php-whole-file-pilot.v1.json`
- `receipts/compiler/wphx-comp-php-module-function-adapters.v1.json`
- `receipts/compiler/wphx-comp-php-embed-module-functions.v1.json`
- `receipts/compiler/wphx-comp-php-https-module-functions.v1.json`
- `receipts/compiler/wphx-comp-php-wp-embed-handlers.v1.json`
- `receipts/compiler/wphx-comp-php-wp-oembed-providers.v1.json`

## Questions For The Oracle

1. Is the staged WPHX PHP path still the best route for the project vision, given the evidence now accumulated?
2. Are Adapter IR, WordPress-profile adapters, reusable PHP core IR, and stock-Haxe-PHP std/runtime borrowing separated cleanly enough?
3. Are the current promotion gates strong enough to prevent accidental WordPress-only backend accretion?
4. Should the project start a parallel extracted `reflaxe.php` target now, wait for more backend-scale pressure, or keep WPHX PHP in-repo until the next ADR?
5. Is the generated PHP quality bar high enough for public WordPress distribution code, including plugin/theme reflection, stack traces, operational debugging, and contributor readability?
6. Which recently added slices look like healthy compiler pressure, and which ones indicate the architecture is drifting?
7. What evidence should be required before replacing stock Haxe PHP as the private implementation emitter?
8. What evidence should be required before claiming full `class-wp-oembed.php`, `class-wp-embed.php`, or `class-wp-http.php` ownership?
9. Which generic PHP lowering features should be promoted next into reusable WPHX PHP core IR instead of remaining WordPress-profile adapters?
10. What are the strongest arguments against the current path, and what would falsify the pivot?

## Expected Output

Ask the oracle for:

- a soundness verdict on the pivot;
- a list of architectural risks and missing evidence;
- specific changes to ADR-015, ADR-016, or ADR-017 if needed;
- a recommendation on when to begin a parallel extracted `reflaxe.php` target;
- concrete next compiler-pressure fixtures;
- clear stop/pivot criteria if the current lane starts producing poor generated PHP or too much WordPress-specific compiler logic.

The response should be stored as an operations receipt, summarized in `docs/operations/oracle.md`, and reflected in Beads before any future ADR claims full backend promotion, stock-target abandonment, or mature `reflaxe.php` scope.
