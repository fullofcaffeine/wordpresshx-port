package wphx.wp.db;

@:keep
class WpdbQueryExecutionStrategy
{
	public static inline final BODY_QUERY = "query";
	public static inline final BODY_DO_NATIVE_QUERY = "do_native_query";
	public static inline final BODY_DB_CONNECT_SUCCESS = "db_connect_success";
	public static inline final BODY_CHECK_CONNECTION_RECONNECT = "check_connection_reconnect";
	public static inline final BODY_ROUTE_TYPED_HAXE_DECISION = "typed_haxe_execution_decision_php_abi_body";
	public static inline final ROUTE_UNKNOWN = "unknown";

	public static function ownedExecutionBodies():Array<String>
	{
		return [
			BODY_QUERY,
			BODY_DO_NATIVE_QUERY,
			BODY_DB_CONNECT_SUCCESS,
			BODY_CHECK_CONNECTION_RECONNECT
		];
	}

	public static function executionBodyRoute(bodyName:String):String
	{
		if (contains(ownedExecutionBodies(), bodyName))
		{
			return BODY_ROUTE_TYPED_HAXE_DECISION;
		}
		return ROUTE_UNKNOWN;
	}

	public static function ownsExecutionBody(bodyName:String):Bool
	{
		return executionBodyRoute(bodyName) == BODY_ROUTE_TYPED_HAXE_DECISION;
	}

	public static function shouldShortCircuitNotReady(ready:Bool):Bool
	{
		return !ready;
	}

	public static function shouldRunFilteredQuery(query:String):Bool
	{
		return WpdbQueryState.shouldRunQuery(query);
	}

	public static function shouldResetInsertIdForEmptyQuery(queryShouldRun:Bool):Bool
	{
		return !queryShouldRun;
	}

	public static function shouldRunInvalidTextCheck(checkCurrentQuery:Bool, asciiOk:Bool):Bool
	{
		return checkCurrentQuery && !asciiOk;
	}

	public static function shouldRejectStrippedQuery(strippedMatchesOriginal:Bool):Bool
	{
		return !strippedMatchesOriginal;
	}

	public static function shouldResetCheckCurrentQueryAfterValidation():Bool
	{
		return true;
	}

	public static function funcCallValue(query:String):String
	{
		return "$db->query(\"" + query + "\")";
	}

	public static function queryKind(query:String):String
	{
		return WpdbQueryState.queryKind(query);
	}

	public static function shouldReturnNativeResult(kind:String):Bool
	{
		return WpdbQueryState.shouldReturnNativeResult(kind);
	}

	public static function shouldUseAffectedRows(kind:String):Bool
	{
		return WpdbQueryState.shouldUseAffectedRows(kind);
	}

	public static function shouldStoreInsertId(kind:String):Bool
	{
		return WpdbQueryState.shouldStoreInsertId(kind);
	}

	public static function shouldClearInsertIdAfterError(currentInsertId:Int, kind:String):Bool
	{
		return WpdbQueryState.shouldClearInsertIdAfterError(currentInsertId, kind);
	}

	public static function shouldAttemptReconnect(dbhIsEmpty:Bool, mysqlErrno:Int):Bool
	{
		return WpdbNativeExecution.shouldAttemptReconnect(dbhIsEmpty, mysqlErrno);
	}

	public static function shouldExecuteNativeQuery(dbhPresent:Bool):Bool
	{
		return WpdbNativeExecution.shouldExecuteNativeQuery(dbhPresent);
	}

	public static function shouldCaptureQueryLog(saveQueriesEnabled:Bool):Bool
	{
		return WpdbNativeExecution.shouldCaptureQueryLog(saveQueriesEnabled);
	}

	public static function nextQueryCount(currentCount:Int):Int
	{
		return WpdbNativeExecution.nextQueryCount(currentCount);
	}

	public static function shouldPopulateSelectedRows(resultIsNativeResult:Bool):Bool
	{
		return WpdbResultPopulation.shouldPopulateRows(resultIsNativeResult);
	}

	public static function initialSelectedRowCount():Int
	{
		return WpdbResultPopulation.initialSelectedRowCount();
	}

	public static function nextSelectedRowCount(currentCount:Int):Int
	{
		return WpdbResultPopulation.nextSelectedRowCount(currentCount);
	}

	public static function selectedRowsReturnValue(numRows:Int):Int
	{
		return WpdbResultPopulation.selectedRowsReturnValue(numRows);
	}

	public static function shouldInitializeCharsetOnDbConnect(hasConnected:Bool):Bool
	{
		return !hasConnected;
	}

	public static function shouldMarkDbConnectionReady(dbhPresent:Bool):Bool
	{
		return dbhPresent;
	}

	public static function preservesFlushAndColumnInfoStrategy():Bool
	{
		return WpdbMethodBodyStrategy.ownsMethodBody("flush") && WpdbMethodBodyStrategy.ownsMethodBody("get_col_info");
	}

	public static function preservesClassShellStrategy():Bool
	{
		return WpdbClassShellStrategy.usesExpandedPublicStateAdapter() && WpdbClassShellStrategy.preservesPluginAbiCompatibility();
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
