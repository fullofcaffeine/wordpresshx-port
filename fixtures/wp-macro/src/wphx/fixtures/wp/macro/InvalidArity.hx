package wphx.fixtures.wp.macro;

@:build(wphx.wp.macros.BindingValidator.build())
class InvalidArity
{
	public static function main():Void {}

	@:wp.global("add_filter", "src/wp-includes/plugin.php")
	public static function addFilter(hookName:String):Bool
	{
		return true;
	}
}
