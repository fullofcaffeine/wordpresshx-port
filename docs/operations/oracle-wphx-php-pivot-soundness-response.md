# Oracle Review: WPHX PHP Pivot Soundness

Recorded: 2026-07-03
Review issue: `wordpresshx-no9p` / `WPHX-COMP-PHP-PIVOT-SOUNDNESS-ORACLE`
Behavior oracles: WordPress and Gutenberg. External architecture reviewer: the oracle.

## Soundness verdict

**Verdict: sound with amber conditions.** The staged WPHX PHP pivot remains the best route for the project vision. The evidence now supports ADR-016's decision to make WPHX PHP the primary lane for new public WordPress PHP emission, while preserving ADR-015 and ADR-017's non-claims: WPHX PHP is not yet a mature arbitrary-Haxe PHP backend, and stock Haxe PHP remains the private implementation emitter and `std/php` behavior oracle until a later backend-promotion ADR moves that responsibility.

The pivot is justified because the PRD's hard compatibility requirements are public-PHP topology requirements, not only expression-lowering requirements: original paths, declaration timing, native arrays, references, globals, include behavior, reflection-visible ABI, warnings, stack traces, and mixed template semantics. Those are exactly the places where stock Haxe PHP should not be allowed to shape the public WordPress distribution surface.

The conditions are important:

1. Treat the current WPHX PHP lane as **staged Adapter IR + reusable PHP core IR + WordPress profile**, not as a complete backend.
2. Keep moving repeated generic constructs out of `WphxPhpWordPressAdapters.hx` and into reusable core IR.
3. Make profile growth and stock/bootstrap/helper reliance trend-gated, not merely pass/fail gated.
4. Do not start an extracted `reflaxe.php` target yet; start extraction hygiene now.
5. Do not claim full `class-wp-http.php`, `class-wp-embed.php`, or `class-wp-oembed.php` ownership until whole-file and installed/package gates pass.

## Evidence reviewed

The review used the ADRs, compiler docs, source snapshot, and the current WPHX PHP evidence manifests/receipts listed by the prompt. Load-bearing evidence includes:

- `compiler-gap-inventory.v1.json`: 44 hxmls, 32 WPHX PHP public-adapter hxmls, 12 stock Haxe PHP private-output hxmls, 61 adapter metadata sites, 59 helper metadata sites, 97 bootstrap metadata sites, 54 WordPress-profile method adapters, 5 script adapters, 23 unsupported report sites, 6 runner copy/patch surfaces, and zero inline `PhpRawBlock` / zero `renderTemplate` debt.
- `wphx-php-adoption-ci.v1.json`: passed the usable-compiler gate and explicitly unblocks bounded parallel Core work when new public emission routes through WPHX PHP.
- `public-shell-snapshots.v1.json`: 25 generated-shape cases, byte-stable clean compiles, PHP lint, exact contracts, AST contracts, segment-plan contracts, and `unsupported=[]` for claimed boundaries.
- `runtime-stdlib-strategy.v1.json`: stock Haxe PHP release/debug probes passed and are correctly treated as behavior-oracle/borrowing evidence, not WPHX runtime ownership.
- `core-lowering-pilot.v1.json`: a no-WordPress-profile, no-helper, no-bootstrap core-lowering fixture passed.
- `whole-file-class-http.v1.json`: a minimized real WordPress file, `wp-includes/class-http.php`, reached `whole_file_owned` without helper/bootstrap fallback.
- `feed-module-functions.v1.json`, `embed-module-functions.v1.json`, and `https-module-functions.v1.json`: selected original-path module-function adapters now pass lint, reflection/ABI checks, `unsupported=[]`, and oracle/candidate behavior probes.
- `wp-embed-handlers.v1.json`: 43 WP_Embed handler/cache/autoembed cases passed for a bounded generated original-path shell.
- `wp-oembed-providers.v1.json`: 5 WP_oEmbed provider queue/static-property cases passed and promoted static-property IR pressure into compiler core.
- `adapter-raw-block-policy.v1.json`: the profile remains at zero inline raw PHP adapter bodies and zero active adapter templates.

One evidence hygiene issue should be fixed: the prompt lists `receipts/compiler/wphx-comp-php-whole-file-class-http.v1.json`, but the snapshot contains `receipts/compiler/wphx-comp-php-whole-file-pilot.v1.json`. Either rename/add an alias receipt or correct the prompt bundle.

## Direct answers to the oracle questions

### 1. Is the staged WPHX PHP path still the best route?

Yes. It is the best route for the next phase because it aligns with the PRD and now has executable evidence beyond smoke shells: public shell snapshots, bootstrap/error/debug probes, raw-block guards, a core-lowering pilot, a whole-file pilot, and multiple post-pivot public WordPress slices. Stock Haxe PHP remains useful, but mostly as private implementation output and as the `std/php` behavior oracle. Public WordPress distribution code should be routed through WPHX PHP.

### 2. Are Adapter IR, WordPress-profile adapters, reusable PHP core IR, and stock-Haxe-PHP borrowing separated cleanly enough?

Mostly, but the separation is under real pressure. The compiler source has a recognizable core/profile split: `WphxPhpCompiler.hx` owns file/declaration plans, `PhpCoreStmt`, `PhpCoreExpr`, printing, manifests, and segment plans; `WphxPhpWordPressAdapters.hx` owns WordPress-specific method adapter bodies. ADR-017 keeps runtime/std ownership with stock Haxe PHP unless moved by later evidence.

The risk is scale: the current profile has 54 method adapters, all under `wp-http`, `wp-embed`, or `wp-oembed`, and the compiler core still contains named script-adapter switches for direct-script/template/whole-file pilots. That is acceptable as a staging point, but it should trigger a profile-to-core promotion audit for every new adapter. Each adapter should carry an explicit classification: `profile_only_abi_constraint`, `core_ir_candidate`, `temporary_bridge`, or `backend_promotion_pressure`.

### 3. Are promotion gates strong enough to prevent accidental WordPress-only backend accretion?

The current gates are conceptually strong, but they need trend triggers. ADR-015's backend-promotion criteria are correct: broad expression lowering, repeated generic features, runtime/std replacement, mixed-template ownership, stock-output failure, or compiler-wide debug/formatting pressure should force a backend-promotion ADR.

What is missing is automation around drift. Add CI checks that fail or at least block durable claims when:

- WordPress-profile adapter count rises without a corresponding core-IR promotion note.
- Helper/bootstrap metadata counts rise across two consecutive public slices without a reduction plan.
- Runner copy/patch surfaces increase.
- A new profile adapter uses PHP syntax that could be represented by reusable core IR.
- Any `PhpRawBlock` or active adapter template returns without a manifest removal gate.
- Public-shell snapshots do not cover the generated shape for a new public boundary.

### 4. Should the project start a parallel extracted `reflaxe.php` target now?

No. Keep WPHX PHP in-repo until the next ADR. Start **extraction hygiene**, not a parallel extracted target: keep core IR WordPress-neutral, avoid WordPress names in generic features, add non-WordPress compiler fixtures for core lowering, document a stable core/profile boundary, and keep stock runtime/std borrowing explicit.

Begin a parallel extracted `reflaxe.php` target only after backend-scale pressure is evidenced, such as: WPHX PHP replaces at least one meaningful stock private-output hxml, owns a nontrivial generic runtime/std subset, has non-WordPress PHP core IR fixtures, and two or more independent WordPress domains require broad generic expression lowering that cannot remain bounded Adapter IR.

### 5. Is the generated PHP quality bar high enough for public distribution code?

The bar is high enough for current bounded claims, but not yet high enough for broad public distribution claims. The current gates cover lint, snapshots, AST/declaration contracts, reflection/ABI checks, runtime probes, unsupported manifests, bootstrap/error/debug evidence, and readability as a stated requirement. That is the right foundation.

Before public distribution claims, add plugin/theme/operator gates: plugin reflection fixtures, subclass/attribute/property/method visibility checks, stack traces from packaged original paths, source-map/debug review, warning/deprecation behavior across representative failures, and at least one human-readable generated-PHP review checklist or AST-normalized style/readability gate.

### 6. Which recent slices are healthy compiler pressure, and which indicate drift?

Healthy pressure:

- `core-lowering-pilot`: proves generic lowering without WordPress profile, helper, or bootstrap reliance.
- `whole-file-class-http`: proves a complete real WordPress file without stock public-shape fallback.
- `public-shell-snapshots`: keeps generated shape deterministic and reviewable.
- `runtime-stdlib-strategy`: correctly treats stock Haxe PHP as an oracle/borrowing source.
- `wp-oembed-providers`: promotes static-property pressure into core IR instead of only a profile body.
- Feed/embed/HTTPS module-function adapters: healthy as selected original-path module-function pressure when they preserve non-claims and keep behavior delegated behind public ABI boundaries.

Drift warnings:

- `wp-embed-handlers` is valuable but large: 43 cases and a broad generated shell can normalize WordPress-profile method bodies unless follow-up promotes repeated constructs into core IR.
- The WordPress profile has 54 method adapters; that is now high enough to require a recurring promotion audit.
- 59 helper metadata sites and 97 bootstrap sites mean stock/private-output dependence is still substantial.
- 6 runner copy/patch surfaces remain. They are tracked, but they should trend down before claims broaden.
- Named script adapters still live in the compiler core. That is acceptable for pilots, but script adapter registration should move toward a profile registry or generic file-segment IR API.

### 7. What evidence is required before replacing stock Haxe PHP as private implementation emitter?

Require a dedicated private-emitter promotion gate. Minimum evidence:

- Replace one currently stock-Haxe-PHP private-output hxml with WPHX PHP and pass the same behavior probes.
- Differentially compare WPHX PHP vs stock Haxe PHP for arrays/maps/iterators, closures, exceptions, strings/Unicode-sensitive operations, JSON, reflection basics, dynamic dispatch, object construction, anonymous structures, enums or enum-equivalent patterns, static fields, and `std/php` externs used by the port.
- Prove boot/autoload/error-handler/source-map behavior for WPHX-owned private output without relying on the stock bootstrap unless explicitly borrowed.
- Establish runtime/std borrowing source hashes and tests for each borrowed component.
- Run representative nontrivial Haxe modules through WPHX PHP without source contortions, raw PHP strings, or helper bridges.
- Add performance/debuggability checks sufficient to avoid replacing correct stock output with slower or harder-to-debug WPHX output.
- Amend ADR-017 or introduce a backend-promotion ADR before treating stock Haxe PHP as abandoned.

### 8. What evidence is required before claiming full `class-wp-oembed.php`, `class-wp-embed.php`, or `class-wp-http.php` ownership?

For each file, require a whole-file ownership manifest and package-level behavior gates:

- Complete source-surface inventory: declarations, properties, constants, attributes, guards, includes, top-level effects, globals, static state, method visibility, references, defaults, and callback surfaces.
- WPHX-generated original-path file with `unsupported=[]`, no copied shell body, no runner patching, and deterministic snapshots.
- Reflection/ABI checks for every public/protected/private method and property where WordPress/plugin behavior can observe it.
- Oracle/candidate behavior probes that cover success/failure/null/false/empty/warning branches, native arrays, object identity, static state, filter/action payloads, repeated include, and error behavior.
- Packaged installed-style gates and selected upstream PHPUnit pass/pass ratchets for the file's domain.
- For `class-wp-http.php`: full request orchestration, Requests integration, redirects, cookies, streams, headers, proxy/TLS handoff, nonblocking/exception behavior, `http_api_debug`, live/fake transport boundaries, and package stack traces.
- For `class-wp-embed.php`: constructor hooks, shortcode registry, handler priority, cache/meta/cache-post behavior, autoembed, Ajax/admin paths, KSES/filter timing, REST handoff, and installed route behavior.
- For `class-wp-oembed.php`: provider table construction, early provider queues, provider matching, `__call`, fetch/discover/network seams, JSON/XML parsing, `data2html`, REST controller interaction, and installed oEmbed routes.

Partial generated shells may remain `compiler_emitted_original_path_shell` or `durable_public_adapter`; they are not `whole_file_owned` until all file-level behavior is covered or explicitly out of scope by an accepted preservation policy.

### 9. Which generic PHP lowering features should be promoted next into reusable core IR?

Prioritize features now repeated across HTTP/embed/oEmbed/feed slices:

1. `isset`, `empty`, `array_key_exists`, null/missing-key distinctions, and falsey-value-preserving array reads/writes.
2. Nested native array mutation, array append, unset, and by-reference parameter/slot mutation.
3. Static properties and property defaults beyond the current bounded static-property support.
4. Dynamic property/member access, dynamic class construction, and class-string/callable handling.
5. Function/method/static calls with named helper roles replaced by typed callable/call IR where practical.
6. PHP closures/callback arrays and `call_user_func`-style behavior, including reference mutation through callbacks.
7. Direct file-scope statements, `require`/`require_once`, include returns, and segment plans as reusable file IR rather than named script switches.
8. Exception `try/catch/throw` coverage, including WordPress-compatible warning/deprecation non-conversion policy.
9. Attributes, visibility, defaults, variadics, references, return types, and doc/comment/source-position emission in the generic declaration printer.
10. Source-map/source-comment and stack-frame mapping policy for generated public files and private implementation output.

### 10. What are the strongest arguments against the current path, and what would falsify the pivot?

Strongest arguments against the path:

- The profile adapter registry can become a WordPress-only backend without a declared backend architecture.
- Stock Haxe PHP bootstrap/helper reliance can remain high enough that WPHX public shells are only wrappers over stock output rather than true generated public PHP.
- Generated PHP may pass narrow probes while still being too unfamiliar, noisy, or stack-trace-hostile for WordPress operators and plugin/theme developers.
- Exact fixture probes can overfit selected branches and miss package/plugin behavior.
- Delaying extraction too long can entangle reusable PHP core IR with WordPress naming and assumptions.

Falsification criteria:

- New public slices repeatedly require runner patches, source contortions, copied public shells, or raw PHP blocks.
- Profile adapters grow faster than reusable core IR for two or three consecutive slices.
- Public shell snapshots or reflection/plugin fixtures fail because generated shape is not WordPress-compatible.
- Bootstrap/error-handler/source-map behavior cannot be made WordPress-compatible in packaged distribution flows.
- Stock Haxe PHP private output becomes the limiting quality bottleneck and WPHX PHP cannot replace it with correct generic runtime/std behavior.
- Whole-file ownership attempts for `class-wp-http.php`, `class-wp-embed.php`, or `class-wp-oembed.php` fail at installed/package gates despite passing isolated adapter probes.

## Specific ADR changes recommended

### ADR-015

Add a **profile accretion gate**: every new WordPress-profile adapter must declare whether it is profile-only, temporary, or a reusable core-IR candidate. Record adapter-count deltas in the gap inventory and adoption CI. Trigger backend-promotion review when profile-specific methods grow materially without corresponding core IR promotions, or when a profile adapter contains generic PHP constructs not represented in core IR.

Add an **extraction-readiness checklist**: non-WordPress core IR fixtures, no WordPress names in core features, runtime/std borrowing map, stable core/profile API, and source-map/debug policy. This is not permission to extract now; it defines when extraction is cheap enough to start.

### ADR-016

Amend the usable-compiler gate to become a **continuous adoption gate**, not only a one-time checkpoint. Each new public slice should either keep adoption CI green or record why it is outside the CI envelope. The CI manifest should list excluded WPHX PHP evidence manifests explicitly; the current evidence list does not directly include every post-pivot check even though the gap inventory sees them.

Add a per-slice rule: a new public WordPress boundary must include at least one of these outcomes--core IR promotion, profile-only ABI justification, stock fallback reduction, bootstrap/helper reduction, or a filed backend-pressure issue.

### ADR-017

Add a **private-emitter replacement ladder**: stock Haxe PHP remains the fallback until a WPHX private-output pilot passes; then selected private modules may move one fixture at a time; only after runtime/std/dynamic/source-map coverage passes may a backend-promotion ADR remove stock Haxe PHP from default private-output duty.

Clarify that borrowing stock runtime/std behavior means either direct reuse, source-adapted reuse with hashes, or deliberate replacement with a minimized fixture proving incompatibility. Avoid unrecorded reimplementation.

## Concrete next compiler-pressure fixtures

1. `WPHX-COMP-PHP-PROFILE-CORE-PROMOTION-AUDIT`: classify all 54 profile adapters and all 5 script adapters by profile-only/core-candidate/backend-pressure status.
2. `WPHX-COMP-PHP-NATIVE-ARRAY-MUTATION-CORE`: generic nested native array read/write/append/unset/isset/empty fixture with null/false/zero/`'0'` distinctions.
3. `WPHX-COMP-PHP-CALLABLE-CLOSURE-CORE`: PHP callable arrays, closures, `call_user_func`, accepted-args behavior, and reference mutation through callbacks.
4. `WPHX-COMP-PHP-STATIC-DYNAMIC-MEMBER-CORE`: static properties/defaults, dynamic properties, class strings, dynamic `new`, and dynamic member access.
5. `WPHX-COMP-PHP-FILE-SEGMENT-CORE-API`: move named script adapter switches toward generic file-segment/direct-script IR registration.
6. `WPHX-COMP-PHP-PRIVATE-EMITTER-PILOT`: replace one of the 12 stock private-output hxmls with WPHX PHP and compare behavior with stock Haxe PHP.
7. `WPHX-COMP-PHP-PLUGIN-REFLECTION-STACKTRACE`: a plugin/theme fixture reflecting generated public functions/classes, subclassing or invoking selected classes, and capturing packaged stack traces/source-map behavior.
8. `WPHX-COMP-PHP-OEMBED-WHOLE-FILE-INVENTORY`: inventory full `class-wp-oembed.php` before adding more provider/fetch/discover methods.
9. `WPHX-COMP-PHP-EMBED-WHOLE-FILE-INVENTORY`: inventory full `class-wp-embed.php` before expanding beyond handler/cache/autoembed slices.
10. `WPHX-COMP-PHP-HTTP-WHOLE-FILE-OWNERSHIP-GATE`: unify existing HTTP durable shell evidence into a file-level manifest before claiming anything stronger than selected boundaries.

## Stop / pivot criteria

Stop broadening the current lane and open a backend-promotion or strategy ADR if any of these occur:

- inline raw PHP or long-lived adapter templates return for public bodies;
- runner copy/patch surfaces increase instead of decrease;
- generated public PHP fails plugin/theme reflection or packaged stack-trace fixtures;
- WordPress-profile adapter count grows materially while core IR feature coverage is flat;
- two independent Core domains need broad arbitrary-Haxe expression lowering or runtime/std ownership;
- stock Haxe PHP private output blocks readable/correct implementation code and cannot be fixed upstream or bounded as a fallback;
- full-file pilots require file-scope Haxe expression lowering, mixed templates, source maps, or dynamic dispatch beyond Adapter IR;
- adoption CI stops tracking the actual evidence surface used by new slices.

## Beads reflection recommendation

Reflect this response on `wordpresshx-no9p` with these accepted decisions:

- Pivot is sound with amber conditions.
- Keep WPHX PHP in-repo on staged Adapter IR/core IR/WordPress-profile path.
- Do not start parallel extracted `reflaxe.php` now; start extraction hygiene.
- Add follow-up gates for profile-core promotion audit, continuous adoption CI, private-emitter replacement ladder, plugin reflection/stack traces, and file-level inventories before full class ownership claims.
- Fix the prompt/receipt path mismatch for the whole-file pilot receipt.

Close `wordpresshx-no9p` only after this receipt and `docs/operations/oracle.md` summary are committed and the follow-up Beads issues are filed or linked.
