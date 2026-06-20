# ADR-002: Dual Upstream Baseline Policy

Status: Accepted

Date: 2026-06-20

## Context

WordPressHX has two upstream tracks that must stay separate:

- WordPress 7.0 release compatibility: WordPress 7.0.0 plus the exact Gutenberg build pinned by WordPress metadata.
- Forward Gutenberg package parity: Gutenberg 23.4.0 as a package/compiler-pressure baseline.

The forward Gutenberg baseline is useful for genes-ts, package graph, React/TSX, and later-release learning. It is not the Gutenberg build embedded in WordPress 7.0.

## Decision

Use two named baseline profiles:

- `wp70-release`
  - Branch family: `release/wp-7.0`.
  - May claim WordPress 7.0 distribution compatibility.
  - Must use `upstream:wordpress-7.0.0`.
  - Must use embedded Gutenberg commit `a2a354cf35e5b69c3330d6c1cfd42d8dc2efb9fd`.
  - Must not use forward Gutenberg source or package artifacts for distro claims.

- `gutenberg-forward-23.4`
  - Branch family: `forward/gutenberg-23.4`.
  - May claim forward Gutenberg package parity only.
  - Must use `upstream:gutenberg-forward-23.4.0`.
  - Must not claim WordPress 7.0 distribution compatibility.

`main` may contain manifests, tools, and receipts for both profiles, but every artifact, receipt, task packet, and future generated output must name the profile it belongs to when there is any ambiguity.

## Enforcement

`manifests/baseline-policy.v1.json` records the machine-readable policy. `npm run baseline:validate` checks the current upstream manifests and inventory/oracle manifests against it.

The repository precommit script runs `baseline:validate`. A change that rewires the WordPress 7.0 release profile to the forward Gutenberg commit, or gives the forward profile a distro claim, must fail validation unless this ADR is superseded.

## Consequences

- The WordPress 7.0 release line can move for security or maintenance only by changing the release baseline manifests and receipts together.
- Forward Gutenberg work can proceed without contaminating the WordPress 7.0 distro claim.
- GutenbergHX bootstrap remains blocked until this policy and the cross-repo protocol are both accepted.
- Dashboard and task-pack work must preserve profile identity when reading inventories.
