package wphx.wp.db.native;

import php.NativeArray;
import php.NativeAssocArray;
import php.NativeIndexedArray;
import php.Ref;
import php.StdClass;
import wphx.wp.boundary.NativeValue.NativeValue;

@:phpGlobal
extern class RowGlobal
{
	@:native("is_object")
	public static function isObject(value:Null<StdClass>):Bool;

	@:native("get_object_vars")
	public static function getObjectVars(row:StdClass):NativeAssocArray<NativeValue>;

	@:native("array_values")
	public static function arrayValues(values:NativeArray):NativeIndexedArray<NativeValue>;

	@:native("array_shift")
	public static function arrayShift(values:Ref<NativeArray>):NativeValue;
}
