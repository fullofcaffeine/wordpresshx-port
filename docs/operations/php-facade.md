# PHP Facade Fixtures

The PHP facade fixtures prove how Haxe-owned implementation code can be exposed through WordPress-shaped global PHP files without asking the stock Haxe PHP target to emit procedural WordPress files directly.

## F1 Global Function

WPHX-102 owns the first facade fixture:

```bash
npm run php:facade:f1
npm run php:facade:f1:check
```

The fixture compiles Haxe implementation code from `fixtures/php-facade/src` and generates an original-path shell at `build/php-facade/generated/wp-includes/plugin.php`. The generated shell conditionally declares `add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 )` and forwards to the Haxe `FacadeKernel`.

The oracle shell is `fixtures/php-facade/oracle/add-filter.php`. The probe compares both shells in separate PHP processes so the global `add_filter` name remains realistic without colliding inside the test process.

The committed snapshot is `manifests/php-facade/wphx-102-f1-global-function.v1.json`. It records:

- generated Haxe PHP file digests;
- generated shell and probe digests;
- local PHP plus pinned Docker PHP 8.4/8.5 runs;
- conditional function availability before and after shell load;
- reflection evidence for parameter names, defaults, required count, return type, by-reference flags, and variadic flags;
- behavior parity for a first `add_filter` call.

This fixture intentionally does not implement the full WordPress hook kernel. WPHX-108 owns hook trace parity after references, native globals, class contracts, and include/load behavior are proven.
