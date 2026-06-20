package wphx.fixtures.wp.macro;

@:build(wphx.wp.macros.BindingValidator.build())
class InvalidMissing
{
	public static function main():Void {}

	@:wp.global("wphx_definitely_missing")
	public static function missing():Void {}
}
