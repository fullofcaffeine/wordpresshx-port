package wphx.fixtures.wp.macro;

@:build(wphx.wp.macros.BindingValidator.build())
@:wp.class("add_filter")
class InvalidKind
{
	public static function main():Void {}
}
