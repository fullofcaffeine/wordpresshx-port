package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Extern for the stock Haxe PHP module-level deprecated parse_url implementation.
**/
@:native("\\wphx\\wp\\http\\_HttpDeprecatedParseUrl\\HttpDeprecatedParseUrl_Fields_")
extern class HaxeHttpDeprecatedParseUrl
{
	static function deprecatedFunctionName():String;
	static function deprecatedVersion():String;
	static function replacementFunctionName():String;
	static function parseUrl(url:String):NativeValue;
}
