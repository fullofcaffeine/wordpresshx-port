# Vanilla Oracle

WPHX-008 creates the first vanilla runtime receipts. The goal is not differential parity yet; it is to prove that the local control plane can produce PHP, DB, and browser baseline evidence from the locked WordPress inputs.

Run:

```bash
npm run oracle:vanilla
```

The runner performs three probes:

- PHP: reads WordPress 7.0 version constants from `../wordpress-develop` and lints `src/wp-settings.php`.
- DB: starts a temporary Dockerized MySQL 8.4 server pinned by digest and queries it through PHP `mysqli`.
- Browser: launches installed Google Chrome through Playwright and captures a DOM/user-agent smoke result.

Outputs:

- `manifests/oracle/vanilla-oracle-baseline.v1.json`
- `receipts/oracle/wphx-008-php-baseline.v1.json`
- `receipts/oracle/wphx-008-db-baseline.v1.json`
- `receipts/oracle/wphx-008-browser-baseline.v1.json`
- `receipts/oracle/wphx-008-vanilla-oracle-summary.v1.json`

Later oracle work should replace these smoke receipts with WordPress install, admin, frontend, editor, REST, and Gutenberg package flows.

## External Architecture Oracle

Some high-impact architecture decisions are prepared for a second-pass GPT 5.5 Pro review. In those notes, **the oracle** means the external architecture reviewer, while WordPress and Gutenberg remain the behavior oracles.

Prompt bundles:

- [Original-path PHP emission strategy](oracle-original-path-php-emission-review.md)
- [WPHX PHP backend strategy](oracle-wphx-php-backend-strategy-review.md)
- [WPHX PHP compiler adoption](oracle-wphx-php-compiler-adoption-review.md)
- [WPHX PHP pivot soundness](oracle-wphx-php-pivot-soundness-review.md)

Accepted responses:

- The 2026-06-29 original-path PHP emission response keeps the hybrid execution strategy: stock Haxe PHP is the private implementation emitter; WPHX PHP is the staged custom compiler lane for bounded WordPress original-path public adapters. The response does not recommend a stock PHP generator fork or immediate arbitrary-Haxe `reflaxe.php` backend flip yet.
- The 2026-07-03 pivot-soundness response keeps the ADR-015/ADR-016/ADR-017 direction: the WPHX PHP pivot is sound with amber conditions after the usable-compiler gate and first post-pivot public slices. WPHX PHP should remain the in-repo staged Adapter IR / reusable PHP core IR / WordPress-profile lane for new public WordPress PHP emission. Stock Haxe PHP remains the private implementation emitter and `std/php` behavior oracle until a later backend-promotion ADR. Do not start a parallel extracted `reflaxe.php` target yet; start extraction hygiene and add profile-accretion, continuous adoption-CI, private-emitter ladder, plugin/reflection/stack-trace, and whole-file inventory gates. The response is recorded in `receipts/operations/wphx-comp-php-pivot-soundness-oracle-response.v1.json` and summarized in `docs/operations/oracle-wphx-php-pivot-soundness-response.md`.
- The 2026-07-03 WPHX-315 bridge-router response accepts copied package roots plus deterministic routers as temporary bridge evidence only. WPHX-315.06 must be read as package-topology and bridge-router observation evidence, not installed WordPress route execution, generated public PHP replacement, Haxe-owned admin runtime logic, durable original-path adapter ownership, or WPHX-owned admin template markup. The response is recorded in `receipts/operations/wphx-315-bridge-router-oracle-response.v1.json` and summarized in `docs/operations/oracle-wphx-315-bridge-router-response.md`.

Pending review:

- Before WPHX PHP is promoted to a full backend, stock Haxe PHP is abandoned as private implementation emitter, or an extracted `reflaxe.php` target is claimed mature, the next ADR must either satisfy the 2026-07-03 pivot-soundness stop/promotion criteria or record a deliberate deferral with rationale. The earlier backend-strategy and compiler-adoption prompt bundles remain useful ADR inputs, but the pivot-soundness response is now the governing oracle checkpoint.
- Before a future admin/template-heavy closure uses copied package roots plus deterministic routers again, it should satisfy the WPHX-315 bridge-router response by adding generated overlay evidence, real installed route execution, typed HXX/HHX template evidence, browser/e2e evidence, database-backed installed admin evidence, or another stronger gate appropriate to the boundary.
