package wphx.fixtures.compiler.php.wp;

/**
	Typed source handles for PHP global functions used by bounded WP_Http shells.
**/
class PhpHttpGlobals
{
	@:wp.phpFunction("_deprecated_function")
	public static function deprecatedFunction(functionName:String, version:String, replacement:String):Void {}
}
