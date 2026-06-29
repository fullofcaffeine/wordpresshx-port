# WPHX PHP Compiler

`WPHX-COMP-PHP` starts the in-repo custom PHP emitter for WordPress-shaped public files.

The compiler is a Haxe/Reflaxe module under `src/wphx/compiler/php`. It uses Reflaxe manual output so emitted file paths can be WordPress distribution paths such as `wp-includes/*.php`, not merely Haxe package paths. Reflaxe is loaded through the explicit classpath recorded in `toolchain.lock.json` and `upstream.lock.json`.

## Current Invocation

```bash
npm run wphx:php:smoke
npm run wphx:php:smoke:check
```

The smoke fixture compiles with:

```bash
haxe fixtures/wphx-php/smoke.hxml
```

The HXML enables:

- `--macro wphx.compiler.php.CompilerInit.Start()`
- `-D wphx_php_output=build/wphx-php/smoke`
- `-D wphx_php_manifest=build/wphx-php/smoke/wphx-php-emission.v1.json`
- `-D wphx_php_profile=wordpress`

## First Contract

The initial metadata contract is intentionally small:

- `@:wp.file("wp-includes/name.php")` selects the generated PHP output path.
- `@:wp.global("function_name")` emits a module-level Haxe function as a global PHP function.
- `@:native("Class_Name")` emits an annotated Haxe class with that public PHP class name.
- `@:wp.ifMissing` wraps generated functions/classes in `function_exists` or `class_exists(..., false)` guards.

The emitter also writes `wphx-php-emission.v1.json` with generated paths, declarations, source modules, hashes-by-runner evidence, and unsupported construct notes.

## Scope

This is not yet a full PHP backend. The first verified behavior is global functions, public classes, constructors, instance/static methods, public properties, simple expressions, PHP lint, and PHP execution. New language features should be added only when a facade, linker, or WordPress driver fixture needs them.

The next target gates are F1/F4 facade replacement and a small WPHX-312 public-method replacement such as `WP_Http::chunkTransferDecode`; the full `WP_Http::request` method is deliberately not the first compiler driver.
