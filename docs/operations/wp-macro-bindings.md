# WordPress ABI Binding Macros

WPHX-202 introduces the first compile-time contract between Haxe declarations and the WordPress PHP ABI manifest from WPHX-201.

Use:

```haxe
@:build(wphx.wp.macros.BindingValidator.build())
@:wp.class("WP_Hook")
class HookBinding {
  @:wp.global("add_filter", "src/wp-includes/plugin.php")
  public static function addFilter(hookName:String, callback:Dynamic, ?priority:Int, ?acceptedArgs:Int):Bool {
    return true;
  }

  @:wp.method("WP_Hook::add_filter")
  public function add_filter(hookName:String, callback:Dynamic, priority:Int, acceptedArgs:Int):Void {}
}
```

Compile with:

```bash
-D wphx.wp.abi=manifests/php-abi/wordpress-7.0-core-abi.v1.json
```

Supported metadata:

- `@:wp.class("Name", "optional/source.php")`
- `@:wp.global("function_name", "optional/source.php")`
- `@:wp.method("Class::method", "optional/source.php")`
- `@:wp.constant("CONSTANT", "optional/source.php")`

If the ABI name appears in more than one source path, the source path is required. This is deliberate: WordPress can expose compatibility/noop declarations and real declarations with the same public name, and later facade/linker work must bind to the intended load segment.

Validation currently checks:

- ABI entry existence by kind/name/path;
- ambiguous binding rejection;
- static requirement for global functions;
- static/non-static match for methods;
- function arity against required/default/variadic ABI parameters.

Run:

```bash
npm run wp:macro:bindings
npm run wp:macro:bindings:check
```

Evidence:

- `manifests/wp-macro/wphx-202-binding-validator.v1.json`
- `receipts/wp-macro/wphx-202-binding-validator.v1.json`
