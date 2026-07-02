# Oracle Review Prompt: WPHX PHP Compiler Adoption

This prompt bundle is for the external architecture reviewer, referred to in project notes as **the oracle**. WordPress and Gutenberg remain the behavior oracles.

## Decision Under Review

Review ADR-016's decision to adopt WPHX PHP now as the primary focus for WordPress PHP emission work, while keeping stock Haxe PHP as a bounded private-output/stdphp oracle until WPHX PHP passes usable-compiler gates.

Current proposed direction:

- WPHX PHP uses Reflaxe infrastructure under `src/wphx/compiler/php`.
- WPHX PHP should become the default path for new public WordPress PHP emission, ABI shells, original-path files, references, native arrays, globals, includes, templates, and generated PHP quality.
- Stock Haxe PHP should not shape new public WordPress PHP architecture; it remains a fallback for private implementation output and a reference for std/php/runtime behavior.
- The project should focus on `WPHX-COMP-PHP-USABLE` before broadening Core PHP port work, then resume Core work in parallel once the adoption CI gate passes.
- Full backend maturity, extraction as `reflaxe.php`, or complete abandonment of stock Haxe PHP still require evidence and a later backend-promotion ADR.

## Context To Provide

- `docs/adr/ADR-001-php-emission-architecture.md`
- `docs/adr/ADR-013-wphx-php-adapter-ir-and-scope.md`
- `docs/adr/ADR-014-haxe-php-bootstrap-lifecycle.md`
- `docs/adr/ADR-015-wphx-php-backend-strategy.md`
- `docs/adr/ADR-016-wphx-php-compiler-adoption-track.md`
- `docs/operations/wphx-php-compiler.md`
- `docs/operations/progress-matrix.md`
- `receipts/compiler/wphx-comp-php-public-shell-snapshots.v1.json`
- `receipts/compiler/wphx-comp-php-request-nonblocking-ir-promotion.v1.json`
- `receipts/compiler/wphx-comp-php-cookie-constructor-ir-promotion.v1.json`
- `receipts/compiler/wphx-comp-php-transport-get-first-ir-promotion.v1.json`

## Questions For The Oracle

1. Is it strategically sound to focus on making WPHX PHP usable now, before broad Core PHP porting continues?
2. Are the `WPHX-COMP-PHP-USABLE` gates sufficient to prevent compiler debt and WordPress-only backend accretion?
3. Which stock Haxe PHP runtime/std behaviors should be reused directly, adapted, or replaced first?
4. What is the smallest whole-file WordPress pilot that would prove the right compiler surface without creating misleading scope claims?
5. Which generic PHP lowering features should move into reusable WPHX PHP core IR before more WordPress profile adapters are added?
6. What evidence should be required before abandoning stock Haxe PHP for private implementation output?
7. Should a reusable `reflaxe.php` extraction start now, run in parallel later, or wait until after the whole-file pilot?

## Expected Output

Ask the oracle for:

- a recommended sequencing plan;
- risks or missing evidence in ADR-016;
- changes to the usable-compiler gates;
- concrete compiler fixtures to add next;
- a clear statement on when stock Haxe PHP should stop being used for this port.

The response should be stored as an operations receipt and summarized in `docs/operations/oracle.md` before any future ADR claims full backend promotion or stock-target abandonment.
