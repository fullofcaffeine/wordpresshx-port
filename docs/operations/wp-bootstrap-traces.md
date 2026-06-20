# WordPress Bootstrap Traces

WPHX-301 starts the WordPress PHP core port with a bootstrap trace harness.

## Contract

- The oracle is the locked WordPress 7.0 checkout at `../wordpress-develop`.
- The harness reads `wp-load.php`, `wp-settings.php`, `wp-includes/load.php`, and `wp-includes/default-constants.php`.
- It records ordered include/load digests around the `SHORTINIT` gate, `WP_INSTALLING` behavior, setup-config discovery, and recovery-mode initialization.
- The Haxe fixture models the scenario gates with typed trace records; it does not claim full bootstrap parity yet.
- The ownership manifest marks the bootstrap workset as `scaffolded_haxe`.

## Scenarios

- `normal`
- `shortinit`
- `install`
- `recovery`

## Verification

Run:

```bash
npm run wp:bootstrap:trace
npm run wp:bootstrap:trace:check
```

Evidence is recorded in:

- `manifests/wp-bootstrap/wphx-301-bootstrap-traces.v1.json`
- `manifests/ownership/wphx-301-bootstrap-workset.v1.json`
- `receipts/wp-bootstrap/wphx-301-bootstrap-traces.v1.json`
