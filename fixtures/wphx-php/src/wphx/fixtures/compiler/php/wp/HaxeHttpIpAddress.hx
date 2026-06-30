package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Extern for the stock Haxe PHP module-level IP-address helper implementation.
**/
@:native("\\wphx\\wp\\http\\_HttpIpAddress\\HttpIpAddress_Fields_")
extern class HaxeHttpIpAddress
{
	static function ipAddressVersion(maybeIp:String):NativeValue;
}
