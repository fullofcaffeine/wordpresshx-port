package wphx.fixtures.compiler.php;

/**
	Annotated fixture declarations that must lower to WordPress-shaped PHP.
**/
@:wp.file("wp-includes/wphx-smoke.php")
@:native("WPHX_Smoke_Counter")
@:wp.ifMissing
@:keep
class SmokeSurface
{
	public var value:Int;

	public function new(value:Int)
	{
		this.value = value;
	}

	public function increment(by:Int = 1):Int
	{
		this.value += by;
		return this.value;
	}

	public static function label():String
	{
		return "counter";
	}
}

@:wp.file("wp-includes/wphx-smoke.php")
@:wp.global("wphx_smoke_add")
@:wp.ifMissing
@:keep
function add(a:Int, b:Int):Int
{
	return a + b;
}

@:wp.file("wp-includes/wphx-smoke.php")
@:wp.global("wphx_smoke_greeting")
@:wp.ifMissing
@:keep
function greeting(name:String):String
{
	return "Hello, " + name;
}
