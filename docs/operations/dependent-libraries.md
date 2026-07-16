# Dependent Library and GutenbergHX Policy

This project should split dependent work only when the split improves verified parallelism more than it adds coordination cost.

## WordPressHx SDK

`wordpress-hx-sdk` is the planned separate typed-authoring product for Haxe plugins, themes, blocks, editor extensions, and complete WordPress solutions that consume the native WordPress and Gutenberg runtimes. It is not part of the full-port ownership claim and must be useful against unmodified vanilla WordPress without depending on `wordpresshx-port` implementation internals.

The intended dependency direction is one-way: `wordpresshx-port` may pin released SDK contracts and use the same extension examples as compatibility probes, while `wordpress-hx-sdk` depends only on public WordPress/Gutenberg contracts and generic compiler libraries. SDK task authority, releases, examples, and maturity claims should live in its own repository once its PRD and bootstrap ADR are accepted. Cross-repository integration receipts belong here when the full port consumes an SDK release.

The same compiled SDK-authored extension should eventually run against both the vanilla WordPress baseline and a WordPressHx Port distribution. Passing against vanilla is SDK evidence; passing against the generated distribution is port compatibility evidence. Neither claim substitutes for Haxe ownership of WordPress or Gutenberg runtime logic.

## GutenbergHX

`gutenberghx` is a good future sibling repository, but it should not be created merely because Gutenberg is large.

Baseline separation is governed by [ADR-002](../adr/ADR-002-dual-upstream-baseline-policy.md). GutenbergHX work may use the forward Gutenberg profile, but WordPress 7.0 distribution claims must stay on the `wp70-release` profile.

Create it when these are true:

- WordPress 7.0's exact pinned Gutenberg build is locked.
- The forward `../gutenberg` baseline is locked.
- Gutenberg package inventory/export metadata exists.
- The genes-ts browser platform has passed at least the first real package and React/TSX feasibility spikes.
- Cross-repo task, manifest, and receipt flow is documented well enough that agents can work there without inventing a second task authority.

Recommended trigger: after `WPHX-403` and `WPHX-404` pass, or earlier only if an ADR explicitly accepts the coordination cost.

Current status: WPHX-402 satisfies the locked package/workspace/module/export/artifact inventory prerequisite, WPHX-403 passes the F8 real leaf-package roundtrip for `@wordpress/escape-html`, and WPHX-404 passes the bounded F9 React/TSX browser, visual, accessibility, source-map, and maintained-ts2hx roundtrip gate. The technical trigger is now satisfied, but repository creation still requires an explicit bootstrap/ADR decision and a documented cross-repo receipt flow. WPHX-405 is the next browser-platform task; WPHX-501 remains blocked by WPHX-406 through WPHX-409, so broad Gutenberg translation has not started.

Do not bootstrap `gutenberghx` merely because the feasibility trigger passed. Until the explicit split decision is recorded, Gutenberg package work remains in `wordpresshx-port` as inventory, feasibility fixtures, and task packets against `../gutenberg`.

## Relationship Between Repos

When created, `gutenberghx` should be a sibling implementation repo, not a vendored subtree:

```text
wordpresshx-port/  # full-port root, WordPress distro integration, root Beads authority
gutenberghx/       # Gutenberg package implementation repo
gutenberg/         # upstream oracle checkout
genes/             # compiler checkout
```

`wordpresshx-port` should reference `gutenberghx` through lock manifests, package artifact manifests, receipts, and integration build inputs. `gutenberghx` should reference `wordpresshx-port` as the program authority and distribution consumer.

Until an ADR changes this, `wordpresshx-port/.beads` remains the active task authority. Work in `gutenberghx` should use a wrapper or Beads redirect back to the root program database rather than creating an independent issue store.

## Parallel Workflow

When `gutenberghx` is created, parallel work should follow this shape:

- `wordpresshx-port` owns the PRD, root Beads database, release claims, WordPress distro integration, and final receipts.
- `gutenberghx` owns Haxe source for Gutenberg packages, package-level fixtures, package build outputs, and package parity receipts.
- A GutenbergHX task must still have a root Beads issue or generated task packet with a `WPHX-*` external ref.
- Every cross-repo receipt must name both commits: the `wordpresshx-port` program commit and the `gutenberghx` implementation commit.
- `wordpresshx-port` consumes `gutenberghx` through a lock manifest entry, never through an unpinned sibling checkout.
- Generated package artifacts from `gutenberghx` are inputs to WordPress distro integration, not proof that the WordPress 7.0 release profile has changed.

Suggested future manifest fields for a `gutenberghx` lock entry:

```json
{
  "id": "gutenberghx",
  "relativePath": "../gutenberghx",
  "profile": "gutenberg-forward-23.4",
  "commit": "<40-hex>",
  "artifactManifest": "manifests/gutenberg/packages.v1.json",
  "receiptRefs": ["receipt:..."]
}
```

If a package is needed by the WordPress 7.0 distribution, integration remains blocked until `wordpresshx-port` records a receipt proving that the package artifact maps back to the embedded Gutenberg baseline or an ADR-approved exception.

## What Belongs in GutenbergHX

Move work to `gutenberghx` when it is primarily about:

- `@wordpress/*` package source and public exports;
- package-wave ports from the Gutenberg dependency graph;
- genes-ts package fixtures driven by Gutenberg package behavior;
- React/TSX package surfaces;
- package build, typecheck, source-map, and bundle parity;
- forward Gutenberg package parity.

Keep WordPress distribution integration in `wordpresshx-port`:

- Core script handles and asset metadata integration;
- exact copied paths required by the WordPress 7.0 distribution;
- the embedded WordPress 7.0 Gutenberg pin;
- PHP/block-library joint work that crosses the PHP pipeline;
- final distro receipts and scorecards.

## Smaller Libraries

Default: keep smaller dependent libraries inside `wordpresshx-port` until evidence says otherwise.

Keep a library in `wordpresshx-port` when:

- it is only needed by the WordPress distribution;
- it has no independent release or consumer surface;
- its behavior is best tested through WordPress/Gutenberg parity;
- splitting would create more manifest and task overhead than parallelism.

Split a smaller library into its own repo only when at least one is true:

- multiple ports can reuse it independently;
- it needs a separate release cadence or package identity;
- it creates sustained compiler-pressure work that benefits from isolated fixtures;
- it has a stable public API worth testing and versioning outside WordPress;
- multiple agents need to work on it without touching WordPress/Gutenberg-owned paths.

Vendor code should still remain inventoried even when it is not split. A bundled vendor may be a direct Haxe port, a Haxe reimplementation over host primitives, a generated wrapper only when upstream has the same runtime dependency assumption, or a temporary exception with a removal gate.

## PHP Vendor Closure

`WPHX-323` records the current WordPress 7.0 bundled PHP vendor/library closure in `manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json` and `receipts/wp-core/wphx-323-php-vendor-manifest-closure.v1.json`.

The closure verifies 293 PHP `vendor_source` entries and 293 matching distribution artifacts as preserved upstream vendor boundaries, including Requests, SimplePie, PHPMailer, getID3, IXR, Text_Diff, sodium_compat, and the TinyMCE PHP loader. It also records additional preserved bundled-library boundaries for php-ai-client, php-compat, POMO, MagpieRSS, PclZip, phpass, Services_JSON, and Snoopy.

This is not Haxe ownership of those implementations. It is an explicit preserved-vendor/library exception with removal gates: future work must either port the API to Haxe, reimplement behavior over a host primitive with fallback, generate a wrapper around an upstream-equivalent dependency, or renew the preserved-artifact exception with tests and provenance.
