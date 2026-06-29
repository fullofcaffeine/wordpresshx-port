package wphx.fixtures.compiler.php.wp;

/**
	Extern for the stock Haxe PHP module-level process-headers line helpers.
**/
@:native("\\wphx\\wp\\http\\_HttpProcessHeaders\\HttpProcessHeaders_Fields_")
extern class HaxeHttpProcessHeaders
{
	static function startsFinalResponseBlock(line:String):Bool;
	static function isHeaderLine(line:String):Bool;
	static function responseCode(line:String):Int;
	static function responseMessage(line:String):String;
	static function headerKey(line:String):String;
	static function headerValue(line:String):String;
}
