package wphx.wp.db;

import php.NativeArray;
import php.NativeAssocArray;
import php.NativeIndexedArray;
import php.StdClass;
import wphx.wp.boundary.NativeValue.NativeValue;
import wphx.wp.db.native.RowGlobal;

@:keep
class WpdbRowMaterialization
{
	public static function hasFetchedRow(row:Null<StdClass>):Bool
	{
		return RowGlobal.isObject(row);
	}

	public static function rowFields(row:StdClass):NativeAssocArray<NativeValue>
	{
		return RowGlobal.getObjectVars(row);
	}

	public static function rowValues(row:StdClass):NativeIndexedArray<NativeValue>
	{
		return RowGlobal.arrayValues(rowFields(row));
	}

	public static function firstFieldValue(row:StdClass):NativeValue
	{
		final fields:NativeArray = rowFields(row);
		return RowGlobal.arrayShift(fields);
	}
}
