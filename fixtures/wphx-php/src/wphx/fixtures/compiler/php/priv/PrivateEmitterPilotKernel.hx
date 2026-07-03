package wphx.fixtures.compiler.php.priv;

/**
	Native PHP exception boundary used by the private-emitter pilot.
**/
@:native("Exception")
extern class PrivateEmitterPilotException
{
	public function new(message:String);
}

/**
	Typed handles for PHP-native operations used by the private-emitter pilot.
**/
class PrivateEmitterPilotOps
{
	@:wp.phpArrayAppend
	public static function appendString(array:Array<String>, value:String):Void {}

	@:wp.phpFunction("count")
	public static function countStrings(array:Array<String>):Int
	{
		return 0;
	}

	@:wp.phpFunction("json_encode")
	public static function jsonEncodeStrings(array:Array<String>):String
	{
		return "";
	}

	@:wp.phpFunction("strtoupper")
	public static function upper(value:String):String
	{
		return value;
	}
}

/**
	WPHX-emitted private implementation candidate mirroring the bootstrap stock kernel.
**/
@:wp.file("haxe/lib/wphx/private-emitter-pilot.php")
@:native("WPHX_Private_Emitter_Pilot")
@:keep
class PrivateEmitterPilotKernel
{
	public static var calls:Array<String> = [];

	public static function mark(label:String):String
	{
		PrivateEmitterPilotOps.appendString(calls, label);
		return "boot:" + label + ":" + PrivateEmitterPilotOps.countStrings(calls);
	}

	public static function snapshot():String
	{
		return PrivateEmitterPilotOps.jsonEncodeStrings(calls);
	}

	public static function fail(label:String):String
	{
		final decorated = PrivateEmitterPilotOps.upper(label);
		throw new PrivateEmitterPilotException("WPHX-BOOTSTRAP-DEBUG:" + decorated);
	}
}
