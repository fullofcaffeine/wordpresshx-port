package wphx.fixtures.wp.macro;

@:build(wphx.wp.macros.BindingValidator.build())
class InvalidAmbiguousGlobal
{
	public static function main():Void {}

	@:wp.global("add_filter")
	public static function addFilter(hookName:String, callback:Dynamic, ?priority:Int, ?acceptedArgs:Int):Bool
	{
		return true;
	}
}
