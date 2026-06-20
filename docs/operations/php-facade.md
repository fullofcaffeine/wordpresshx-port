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

## F2 References

WPHX-103 owns the reference-boundary fixture:

```bash
npm run php:facade:f2
npm run php:facade:f2:check
```

The fixture compares an oracle PHP shell with a generated Haxe-backed shell for:

- by-reference parameters, using `wphx_reference_param( &$value, $suffix = '-ref' )`;
- by-reference returns, using `&wphx_reference_return()`;
- callback invocation with a by-reference argument.

The generated shell still owns the exact procedural PHP reference ABI. Haxe owns the value transformation behind that boundary. This is the current intended shape for WordPress APIs that require PHP references: preserve exact PHP signatures in original-path shells, then cross into Haxe-owned implementation code where the values are no longer references.

The committed snapshot is `manifests/php-facade/wphx-103-f2-references.v1.json`.

## F3 Native Values and Globals

WPHX-104 owns the native values/global fixture:

```bash
npm run php:facade:f3
npm run php:facade:f3:check
```

The fixture compares an oracle PHP shell with a generated Haxe-backed shell for:

- `$GLOBALS` option storage;
- `$_SERVER`-shaped superglobal state;
- `array_key_exists` versus `isset` behavior for `null`;
- `false`, `"0"`, and empty-string distinctions;
- native PHP list/associative arrays and key order;
- callback value flow.

The generated shell decodes Haxe-provided seed JSON into native PHP arrays before exposing values through globals. That keeps WordPress-facing state PHP-native while allowing Haxe to own canonical seed/normalization logic behind the boundary.

The committed snapshot is `manifests/php-facade/wphx-104-f3-native-values.v1.json`.

## F4 Public Classes

WPHX-105 owns the public class/interface fixture:

```bash
npm run php:facade:f4
npm run php:facade:f4:check
```

The fixture compares an oracle PHP shell with a generated Haxe-backed shell for:

- exact global interface and class names;
- conditional class/interface declaration for repeated shell loads;
- inheritance and `instanceof` behavior;
- public constants, static properties, public properties, and protected properties;
- constructor defaults, static factory methods, inherited methods, and instance methods;
- reflection evidence for method parameters, declaring classes, property visibility, constants, parent class, and interfaces.

The generated original-path shell owns the public PHP class ABI and delegates selected method logic to Haxe `ClassKernel`. This keeps plugin-visible reflection and instantiation behavior PHP-native while proving that class methods can cross into Haxe-owned implementation code.

The committed snapshot is `manifests/php-facade/wphx-105-f4-public-class.v1.json`.

## F5 Include and Load

WPHX-106 owns the include/load fixture:

```bash
npm run php:facade:f5
npm run php:facade:f5:check
```

The fixture compares an oracle original-path tree with a generated Haxe-backed original-path tree across four isolated scenarios:

- `entry-default`, which loads `wp-settings.php` twice and proves `require_once` files run once while `include`/`require` files run on each entry load;
- `entry-pluggable-override`, which predeclares a pluggable function and proves the generated shell respects the existing plugin-provided declaration;
- `direct-guard`, which requires `wp-includes/load.php` without `ABSPATH` and proves the direct-load guard returns before public declarations or side effects;
- `scope-include`, which includes a shell inside a PHP function and proves caller-scope local mutation and include return values.

The generated shells own original paths, include timing, top-level side effects, conditional declarations, and PHP return values. Haxe `LoadKernel` owns selected payload helpers behind that boundary.

The committed snapshot is `manifests/php-facade/wphx-106-f5-include-load.v1.json`.

## F6 Template and Caller Scope

WPHX-107 owns the mixed template/caller-scope fixture:

```bash
npm run php:facade:f6
npm run php:facade:f6:check
```

The fixture compares an oracle original-path template tree with a generated Haxe-backed template tree across two isolated scenarios:

- `admin-style`, which includes an admin-like mixed PHP/HTML shell with local variables, escaped output, local array mutation, object mutation, trace side effects, and an include return value;
- `theme-style`, which includes a theme-like mixed PHP/HTML shell with `$post`-shaped local data, class mutation, `$GLOBALS['wp_query']` mutation, a nested template-part include, partial-created caller locals, rendered output, and include return values.

The generated shells own the mixed PHP/HTML output order, caller-scope visibility, local/global mutation, nested includes, escaping boundary, and return values. Haxe `TemplateKernel` owns only bounded helper payloads behind that shell boundary.

This fixture intentionally does not treat HHX as parity evidence for existing mixed PHP/HTML files. HHX remains appropriate only where Haxe owns the template unit or where the file-segment model has bounded the adoption contract.

The committed snapshot is `manifests/php-facade/wphx-107-f6-template-scope.v1.json`.

## F7 Hook Kernel

WPHX-108 owns the hook kernel fixture:

```bash
npm run php:facade:f7
npm run php:facade:f7:check
```

The fixture copies the upstream oracle files from `../wordpress-develop/src/wp-includes/plugin.php` and `../wordpress-develop/src/wp-includes/class-wp-hook.php` into `build/php-hook-kernel/oracle`, then compares that oracle against a generated Haxe-backed `wp-includes/plugin.php` and `class-wp-hook.php`.

The trace covers:

- reflected signatures for `add_filter`, `add_action`, `apply_filters`, `apply_filters_ref_array`, `do_action`, `has_filter`, `remove_filter`, `current_filter`, and `doing_filter`;
- priority ordering and `accepted_args` behavior;
- `remove_filter` behavior;
- `all` hook execution;
- action execution and `did_action`;
- by-reference filter mutation through `apply_filters_ref_array`;
- `current_filter` and `doing_filter` during callbacks;
- native `$wp_filter`, `$wp_filters`, `$wp_actions`, and `$wp_current_filter` globals.

The generated shell keeps PHP callbacks, hook globals, and callback execution native. Haxe `HookKernel` is used only for bounded helper payloads in this fixture. This keeps the first hook proof honest: PHP callable/reference behavior remains observable at the shell boundary, while later kernel work can port more of `WP_Hook` deliberately.

The committed snapshot is `manifests/php-facade/wphx-108-f7-hook-kernel.v1.json`.
