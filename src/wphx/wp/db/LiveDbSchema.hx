package wphx.wp.db;

@:keep
class LiveDbSchema
{
	public static function tableExists(foundTableName:String, expectedTableName:String):Bool
	{
		return foundTableName == expectedTableName;
	}

	public static function shouldIssueCreate(tableExistsBefore:Bool):Bool
	{
		return !tableExistsBefore;
	}

	public static function createResult(tableExistsAfter:Bool):Bool
	{
		return tableExistsAfter;
	}

	public static function columnMatches(foundColumn:String, expectedColumn:String):Bool
	{
		return foundColumn == expectedColumn;
	}

	public static function shouldIssueAlter(columnExistsBefore:Bool):Bool
	{
		return !columnExistsBefore;
	}

	public static function alterResult(columnExistsAfter:Bool):Bool
	{
		return columnExistsAfter;
	}
}
