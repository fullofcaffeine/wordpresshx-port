package wphx.fixtures.wp.macro;

@:build(wphx.wp.macros.BindingValidator.build())
class InvalidStaticGlobal
{
	public static function main():Void {}

	@:wp.global("add_filter", "src/wp-includes/plugin.php")
	public function addFilter(hookName:String, callback:Dynamic, ?priority:Int, ?acceptedArgs:Int):Bool
	{
		return true;
	}
}
