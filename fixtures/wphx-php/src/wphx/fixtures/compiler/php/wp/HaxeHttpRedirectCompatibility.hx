package wphx.fixtures.compiler.php.wp;

/**
	Extern for the stock Haxe PHP module-level redirect compatibility helper.
**/
@:native("\\wphx\\wp\\http\\_HttpRedirectCompatibility\\HttpRedirectCompatibility_Fields_")
extern class HaxeHttpRedirectCompatibility
{
	static function shouldUseBrowserGet(statusCode:Int):Bool;
}
