package wphx.fixtures.compiler.php.wp;

/**
	Extern for the stock Haxe PHP module-level cookie-header assembly helper.
**/
@:native("\\wphx\\wp\\http\\_HttpCookieHeaderAssembly\\HttpCookieHeaderAssembly_Fields_")
extern class HaxeHttpCookieHeaderAssembly
{
	static function appendCookieHeader(current:String, headerValue:String):String;
}
