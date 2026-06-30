package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

@:native("\\wphx\\wp\\http\\_HttpTransportSelection\\HttpTransportSelection_Fields_")
extern class HaxeHttpTransportSelection
{
	static function defaultTransportTokens():NativeValue;

	static function isCoreTransportToken(transport:String):Bool;

	static function coreTransportSuffix(transport:String):String;

	static function transportClassName(transport:String):String;
}
