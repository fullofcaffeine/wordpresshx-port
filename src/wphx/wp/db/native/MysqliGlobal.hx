package wphx.wp.db.native;

import haxe.extern.EitherType;

@:phpGlobal
extern class MysqliGlobal
{
	@:native("mysqli_query")
	public static function query(handle:MysqliHandle, sql:String):EitherType<MysqliResult, Bool>;

	@:native("mysqli_fetch_object")
	public static function fetchObject(result:MysqliResult):Null<php.StdClass>;
}
