# Agent Instruction Hierarchy

This repository keeps its active agent guidance in the root `AGENTS.md`. Longer rationale, source comparisons, and receipt links belong here so the root file stays readable during daily work.

## Active Sources

Agents working in this repository should treat instruction sources in this order:

1. System/developer/runtime instructions supplied by the Codex environment.
2. This repository's root `AGENTS.md`.
3. The PRD at `docs/prd/wordpress-haxe-port.md`.
4. Focused operations docs under `docs/operations/`.
5. Sibling repository `AGENTS.md` files only when a task explicitly enters that repository.

The root `AGENTS.md` must stay concise enough to read at session start. If an instruction needs extended reasoning, examples, or source comparison, put the detail in `docs/operations/` and link it from the root only when it changes day-to-day behavior.

## Reference Repos Reviewed

WPHX-802 reviewed local precedent from:

- `../opencodehx/AGENTS.md` at `341422d4b2f1`.
- `../codex-hxrust/AGENTS.md` at `7675772e44c0`.
- `../genes/AGENTS.md` at `8acd1061fb63`.

Useful patterns adapted here:

- Keep sibling upstream and compiler repositories outside the port repo by default.
- Treat compiler fixes as generic compiler work, never product-specific hacks.
- Follow the target repository's own `AGENTS.md` before editing a sibling repo.
- Keep generated target output as a reviewable product surface.
- Use Beads for task state and close only verified work.
- Commit and push focused completed slices instead of leaving local-only progress.

Patterns intentionally not copied:

- OpenCode-specific upstream, TUI, provider, Node/Bun, and npm package rules.
- Codex/Haxe-Rust-specific `haxe.rust` profile, Rust backend, and Cafex adapter rules.
- Genes compiler-internal hxdoc and fixture mandates except as guidance for future compiler work.
- Any repo-specific public release claims, progress bars, or package metadata.

## Cross-Repo Rule

This repo may reference sibling repos as evidence, but it does not inherit their task databases or operating contracts. When work moves into a sibling repo:

1. Enter that repo.
2. Read its current `AGENTS.md`.
3. Use that repo's Beads/task workflow if present.
4. Commit and push the sibling repo's focused change there.
5. Return here and update WordPressHX pins, manifests, receipts, and Beads notes.

This keeps WordPressHX as the program authority without pretending that compiler or upstream repositories are subdirectories of this project.

## Dynamic And Escape Hatches

`Dynamic`, `untyped`, raw target syntax, broad casts, and generated `any` are compatibility escape hatches, not default modeling tools. New Haxe code must first try concrete types, structural typedefs, abstracts, enums, `EitherType`, target-native externs such as PHP native arrays, or small macros that preserve type information.

If an escape hatch remains necessary, the code must put it at the boundary and document the reason next to the use. A good justification names the runtime shape that Haxe cannot express yet, for example a PHP callable that may be a closure, function name string, or object/method tuple. Do not widen a whole function or class just because one argument is a native boundary value.

When reviewing or continuing work, treat casual `Dynamic` as a defect. Narrow it immediately when the local context is clear; otherwise file Beads follow-up with the boundary, evidence, and removal condition.

## Verification

The WPHX-802 receipt is `receipts/operations/wphx-802-agent-instructions.v1.json`.
