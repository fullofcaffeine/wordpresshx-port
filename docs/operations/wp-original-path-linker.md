# WordPress Original-Path Linker

WPHX-205 adds the deterministic linker for WordPress-shaped PHP distribution trees.

## Contract

- Linker inputs are ordered file segments with an owner, source, kind, and stable hash.
- Output paths are WordPress distribution paths such as `wp-settings.php`, `wp-includes/load.php`, and theme template paths.
- The linker rejects unsafe paths and writes files in deterministic path and segment order.
- PHP shells keep include/load timing, caller-scope template behavior, mixed PHP/HTML output, and conditional declarations at the public edge.
- Haxe payloads live behind those shells in one shared generated runtime directory.
- Durable shell files must be generated artifacts, not hand-maintained PHP implementations hidden in test runners. The shell contract should be Haxe-owned as typed source, metadata, macro output, or linker input so the same WordPress ABI knowledge can generate PHP now and another runtime/language adapter later if the program needs it. Temporary shell scaffolding is acceptable only with an ownership state, receipt evidence, and a removal gate that moves the shape into Haxe macros, the linker emitter, or a generic PHP backend/custom-target improvement.

## Verification

Run:

```bash
npm run wp:linker
npm run wp:linker:check
```

The runner compiles the Haxe helper payload, links one generated WordPress-shaped root, and compares that root to the earlier include/load and template/caller-scope oracle fixtures. Evidence is recorded in:

- `manifests/wp-linker/wphx-205-original-path-linker.v1.json`
- `receipts/wp-linker/wphx-205-original-path-linker.v1.json`
