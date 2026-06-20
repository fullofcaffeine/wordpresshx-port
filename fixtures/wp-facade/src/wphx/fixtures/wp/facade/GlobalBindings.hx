package wphx.fixtures.wp.facade;

import wphx.fixtures.wp.facade.GlobalTypes.NativeWpCallable;
import wphx.fixtures.wp.facade.GlobalTypes.NativeWpValue;

@:build(wphx.wp.macros.BindingValidator.build())
@:keep
class GlobalBindings
{
	@:wp.global("add_filter", "src/wp-includes/plugin.php")
	public static function addFilter(hookName:String, callback:NativeWpCallable, priority:Int, acceptedArgs:Int):Bool
	{
		return GlobalKernel.addFilter(hookName, callback, priority, acceptedArgs);
	}

	@:wp.global("apply_filters", "src/wp-includes/plugin.php")
	public static function applyFilters(hookName:String, value:NativeWpValue, args:php.NativeArray):NativeWpValue
	{
		return GlobalKernel.applyFilters(hookName, value, args);
	}

	@:wp.global("_wp_array_set", "src/wp-includes/functions.php")
	public static function wpArraySet(inputArray:php.NativeArray, path:php.NativeIndexedArray<String>, value:NativeWpValue):php.NativeArray
	{
		return GlobalKernel.wpArraySet(inputArray, path, value);
	}
}
