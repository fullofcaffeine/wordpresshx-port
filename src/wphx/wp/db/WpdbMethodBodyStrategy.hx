package wphx.wp.db;

@:keep
class WpdbMethodBodyStrategy
{
	public static inline final METHOD_FLUSH = "flush";
	public static inline final METHOD_GET_COL_INFO = "get_col_info";
	public static inline final METHOD_BODY_ROUTE_TYPED_HAXE_DECISION = "typed_haxe_decision_php_abi_body";
	public static inline final ROUTE_UNKNOWN = "unknown";
	public static inline final ALL_COLUMN_INFO_OFFSET = -1;

	public static function ownedMethodBodies():Array<String>
	{
		return [METHOD_FLUSH, METHOD_GET_COL_INFO];
	}

	public static function methodBodyRoute(methodName:String):String
	{
		if (contains(ownedMethodBodies(), methodName))
		{
			return METHOD_BODY_ROUTE_TYPED_HAXE_DECISION;
		}
		return ROUTE_UNKNOWN;
	}

	public static function ownsMethodBody(methodName:String):Bool
	{
		return methodBodyRoute(methodName) == METHOD_BODY_ROUTE_TYPED_HAXE_DECISION;
	}

	public static function flushResetPublicProperties():Array<String>
	{
		return ["last_result", "last_query", "rows_affected", "num_rows", "last_error"];
	}

	public static function flushResetLazyParentLoadedProperties():Array<String>
	{
		return ["col_info"];
	}

	public static function flushResetNativeResourceProperties():Array<String>
	{
		return ["result"];
	}

	public static function shouldFreeMysqliResult(resultIsMysqliResult:Bool):Bool
	{
		return resultIsMysqliResult;
	}

	public static function shouldDrainMysqliConnection(resultWasMysqliResult:Bool, dbhIsMysqli:Bool):Bool
	{
		return resultWasMysqliResult && dbhIsMysqli;
	}

	public static function defaultColumnInfoType():String
	{
		return "name";
	}

	public static function shouldReturnAllColumnInfo(colOffset:Int):Bool
	{
		return colOffset == ALL_COLUMN_INFO_OFFSET;
	}

	public static function shouldReturnSingleColumnInfo(colOffset:Int):Bool
	{
		return !shouldReturnAllColumnInfo(colOffset);
	}

	public static function usesParentColInfoLoader():Bool
	{
		return WpdbClassShellStrategy.shouldDelegateLazyReadToParentLoader("col_info");
	}

	public static function usesParentVisibleResultSlot():Bool
	{
		return WpdbClassShellStrategy.shouldStoreNativeResourceInParentVisibleSlot("result");
	}

	public static function preservesPluginAbiCompatibility():Bool
	{
		return WpdbClassShellStrategy.preservesPluginAbiCompatibility();
	}

	public static function preservesRequireWpDbDropinReplacement():Bool
	{
		return WpdbClassShellStrategy.preservesRequireWpDbDropinReplacement();
	}

	static function contains(values:Array<String>, name:String):Bool
	{
		for (value in values)
		{
			if (value == name)
			{
				return true;
			}
		}
		return false;
	}
}
