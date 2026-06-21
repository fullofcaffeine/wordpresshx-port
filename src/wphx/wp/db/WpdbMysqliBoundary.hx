package wphx.wp.db;

@:keep
class WpdbMysqliBoundary
{
	public static function shouldCallQueryBoundary(shouldExecuteNativeQuery:Bool):Bool
	{
		return shouldExecuteNativeQuery;
	}

	public static function shouldCallFetchObjectBoundary(shouldPopulateRows:Bool):Bool
	{
		return shouldPopulateRows;
	}
}
