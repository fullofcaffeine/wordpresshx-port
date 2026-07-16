# ADR-019: WordPressHx Port Project Identity

- Status: Accepted
- Date: 2026-07-16
- Decision owner: Project owner
- Beads: `WPHX-000.08`

## Context

The original `wordpress-hx` name covered both a complete WordPress/Gutenberg porting program and the broader idea of authoring WordPress solutions in Haxe. Those are distinct products. A typed SDK can improve plugin, theme, block, and site authoring while continuing to consume native WordPress and Gutenberg; this repository instead owns the complete-port control plane, implementation work, compatibility evidence, and generated distribution integration.

The repository already has stable `WPHX-*` task references, `wphx.*` receipt/schema names, Haxe namespaces, generated adapter names, historical receipts, and Beads IDs. Those identifiers carry compatibility and provenance value independent of the GitHub repository slug.

## Decision

The canonical project and repository identity is `wordpresshx-port`:

- GitHub repository: `fullofcaffeine/wordpresshx-port`;
- npm/private workspace package: `wordpresshx-port`;
- local checkout directory: `wordpresshx-port`;
- display name: WordPressHx Port;
- active Git and Beads Dolt remotes use the renamed GitHub coordinate.

The repository remains the PRD, Beads, manifest, receipt, compiler-pressure, full-port implementation, and distribution-integration authority. A separately planned `wordpress-hx-sdk` repository will own typed extension authoring against native WordPress/Gutenberg. The SDK must not depend on full-port implementation internals; the port may pin SDK releases and test the same extension artifacts against vanilla and generated distributions.

## Stable Identifiers

The rename does not rewrite these established identifiers:

- `WPHX-*` external task references;
- `wordpresshx-*` Beads issue IDs;
- `wphx.*` schema and receipt identifiers;
- `wphx` Haxe/PHP/compiler namespaces and generated symbol prefixes;
- unrelated `wordpresshx/*` container or package coordinates;
- historical receipts, manifests, task descriptions, commands, and URLs that accurately record the former repository name;
- published schema `$id` values, which remain stable identifiers even when they contain the former repository URL.

GitHub redirects the former repository URL. New active documentation, metadata, commands, and remotes use `wordpresshx-port`; historical evidence remains immutable and the WPHX-000.08 receipt records the transition.

## Consequences

- The full-port objective is unambiguous and cannot be confused with the SDK's wrapper/extension boundary.
- SDK and full-port progress, versions, task stores, and production-readiness claims remain independent.
- Cross-repository receipts must identify exact commits or released SDK versions.
- Any future `gutenberghx` repository continues to treat `wordpresshx-port` as the full-port program authority until another ADR changes that protocol.
- Operators must update existing clones' Git and Beads Dolt remotes. Fresh clones use the new repository slug.
- Historical URLs and schema identifiers may continue to contain `wordpress-hx`; they are legacy evidence, not active project identity.

## Alternatives Considered

### Keep `wordpress-hx`

Rejected because the name does not clearly distinguish the complete port from the independently useful SDK product.

### Rename to `wordpress-hxport`

Rejected in favor of `wordpresshx-port`, which keeps the WordPressHx product name intact and uses `port` as an explicit repository qualifier.

### Create a third umbrella repository immediately

Deferred. The current repository already owns the program control plane and distribution integration. A separate umbrella would add coordination without an implementation need.
