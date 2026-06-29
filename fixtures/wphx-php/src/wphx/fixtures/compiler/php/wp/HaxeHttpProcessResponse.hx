package wphx.fixtures.compiler.php.wp;

/**
	Extern for the stock Haxe PHP module-level process-response implementation.
**/
@:native("\\wphx\\wp\\http\\_HttpProcessResponse\\HttpProcessResponse_Fields_")
extern class HaxeHttpProcessResponse
{
	static function responseHeaders(response:String):String;
	static function responseBody(response:String):String;
}
