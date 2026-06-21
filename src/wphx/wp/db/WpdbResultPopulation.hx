package wphx.wp.db;

@:keep
class WpdbResultPopulation
{
	public static function shouldPopulateRows(resultIsNativeResult:Bool):Bool
	{
		return resultIsNativeResult;
	}

	public static function initialSelectedRowCount():Int
	{
		return 0;
	}

	public static function nextSelectedRowCount(currentCount:Int):Int
	{
		return currentCount + 1;
	}

	public static function selectedRowsReturnValue(numRows:Int):Int
	{
		return numRows;
	}
}
