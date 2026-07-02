package wphx.fixtures.compiler.php.https;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Extern for the stock Haxe PHP implementation behind generated HTTPS functions.
**/
@:native("\\wphx\\fixtures\\php\\https\\HttpsKernel")
extern class HaxeHttpsKernel
{
	static function isUsingHttps():Bool;

	static function isHomeUrlUsingHttps():Bool;

	static function isSiteUrlUsingHttps():Bool;

	static function isHttpsSupported():Bool;

	static function getHttpsDetectionErrors():NativeValue;

	static function shouldReplaceInsecureHomeUrl():Bool;

	static function replaceInsecureHomeUrl(content:String):String;

	static function updateUrlsToHttps():Bool;

	static function updateHttpsMigrationRequired(oldUrl:NativeValue, newUrl:NativeValue):Void;

	static function isLocalHtmlOutput(html:String):NativeValue;
}
