package wphx.fixtures.wp.core;

import php.NativeArray;
import php.NativeAssocArray;
import php.NativeIndexedArray;
import php.Ref;
import php.StdClass;
import wphx.wp.boundary.NativeValue.NativeValue;
import wphx.wp.db.native.RowGlobal;

@:keep
class NativeValueLoweringProofEntry
{
	public static function isRowObject(value:Null<StdClass>):Bool
	{
		return RowGlobal.isObject(value);
	}

	public static function rowFields(row:StdClass):NativeAssocArray<NativeValue>
	{
		return RowGlobal.getObjectVars(row);
	}

	public static function rowValues(values:NativeArray):NativeIndexedArray<NativeValue>
	{
		return RowGlobal.arrayValues(values);
	}

	public static function shiftFirst(values:Ref<NativeArray>):NativeValue
	{
		return RowGlobal.arrayShift(values);
	}

	static function main():Void {}
}
