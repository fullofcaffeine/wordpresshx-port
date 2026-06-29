package wphx.fixtures.compiler.php.byref;

/**
	Annotated fixture for PHP reference-visible parameter ABI emission.
**/
@:wp.file("wp-includes/wphx-byref.php")
@:wp.global("wphx_byref_append")
@:wp.ifMissing
@:keep
function append(@:wp.byRef value:String, suffix:String = "-ref"):String
{
	value = value + suffix;
	return value;
}
