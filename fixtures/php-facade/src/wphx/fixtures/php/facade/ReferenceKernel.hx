package wphx.fixtures.php.facade;

@:keep
class ReferenceKernel
{
	public static function transform(value:String, suffix:String):String
	{
		return value.toUpperCase() + suffix;
	}

	public static function initialStore():String
	{
		return "seed";
	}
}
