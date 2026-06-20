# WordPress Hook Surface

WPHX-302 records the first complete hook/plugin API surface gate for `plugin.php` and
`class-wp-hook.php`.

## Contract

- The oracle is the locked WordPress 7.0 checkout at `../wordpress-develop`.
- The expected symbols come from `manifests/php-abi/wordpress-7.0-core-abi.v1.json`.
- The generated side reuses the F7 hook kernel fixture and original-path generated files.
- The probe reflects every function, class, method, and property in the hook workset.
- The behavior fixture compares deprecated hooks, ref-array actions, remove-all helpers,
  plugin path helpers, activation/deactivation hooks, and uninstall hook registration.

## Ownership

The ownership manifest intentionally marks this workset as a `temporary_bridge`. Hook
callbacks, references, globals, and plugin lifecycle helpers remain PHP-observable. This
gate proves compatibility while later source-unit work can move the hook kernel toward
`haxe_parity_candidate` ownership.

## Verification

Run:

```bash
npm run wp:hooks:surface
npm run wp:hooks:surface:check
```

Evidence is recorded in:

- `manifests/wp-hooks/wphx-302-hook-surface.v1.json`
- `manifests/ownership/wphx-302-hooks-workset.v1.json`
- `receipts/wp-hooks/wphx-302-hook-surface.v1.json`
