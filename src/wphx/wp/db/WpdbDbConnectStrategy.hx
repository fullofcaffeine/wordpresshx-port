package wphx.wp.db;

@:keep
class WpdbDbConnectStrategy
{
	public static inline final BODY_DB_CONNECT = "db_connect";
	public static inline final BODY_PARSE_DB_HOST_HANDOFF = "parse_db_host_handoff";
	public static inline final BODY_NATIVE_REAL_CONNECT = "native_real_connect";
	public static inline final BODY_CONNECTION_FAILURE = "connection_failure";
	public static inline final BODY_CONNECTION_SUCCESS = "connection_success";
	public static inline final BODY_ROUTE_TYPED_HAXE_DECISION = "typed_haxe_db_connect_decision_php_abi_body";
	public static inline final ROUTE_UNKNOWN = "unknown";

	public static function ownedConnectionBodies():Array<String>
	{
		return [
			BODY_DB_CONNECT,
			BODY_PARSE_DB_HOST_HANDOFF,
			BODY_NATIVE_REAL_CONNECT,
			BODY_CONNECTION_FAILURE,
			BODY_CONNECTION_SUCCESS
		];
	}

	public static function connectionBodyRoute(bodyName:String):String
	{
		if (contains(ownedConnectionBodies(), bodyName))
		{
			return BODY_ROUTE_TYPED_HAXE_DECISION;
		}
		return ROUTE_UNKNOWN;
	}

	public static function ownsConnectionBody(bodyName:String):Bool
	{
		return connectionBodyRoute(bodyName) == BODY_ROUTE_TYPED_HAXE_DECISION;
	}

	public static function shouldMarkIsMysql():Bool
	{
		return true;
	}

	public static function clientFlags(mysqlClientFlagsDefined:Bool, mysqlClientFlags:Int):Int
	{
		return mysqlClientFlagsDefined ? mysqlClientFlags : 0;
	}

	public static function shouldDisableMysqliReport():Bool
	{
		return true;
	}

	public static function shouldUseParsedDbHostData(parsedHostDataAvailable:Bool):Bool
	{
		return parsedHostDataAvailable;
	}

	public static function shouldBracketIpv6Host(isIpv6:Bool, mysqlndLoaded:Bool):Bool
	{
		return isIpv6 && mysqlndLoaded;
	}

	public static function bracketIpv6Host(host:String):String
	{
		return "[" + host + "]";
	}

	public static function shouldUseDebugRealConnect(wpDebug:Bool):Bool
	{
		return wpDebug;
	}

	public static function shouldClearDbhOnConnectError(connectErrno:Int):Bool
	{
		return connectErrno != 0;
	}

	public static function shouldBailOnConnectionFailure(dbhPresent:Bool, allowBail:Bool):Bool
	{
		return !dbhPresent && allowBail;
	}

	public static function shouldReturnFalseOnConnectionFailure(dbhPresent:Bool):Bool
	{
		return !dbhPresent;
	}

	public static function shouldRunConnectionSuccess(dbhPresent:Bool):Bool
	{
		return dbhPresent;
	}

	public static function shouldInitializeCharsetOnDbConnect(hasConnected:Bool):Bool
	{
		return !hasConnected;
	}

	public static function shouldSetHasConnected(dbhPresent:Bool):Bool
	{
		return dbhPresent;
	}

	public static function shouldMarkReady(dbhPresent:Bool):Bool
	{
		return dbhPresent;
	}

	public static function shouldSetSqlModeAfterReady(ready:Bool):Bool
	{
		return ready;
	}

	public static function shouldSelectDatabaseAfterReady(ready:Bool):Bool
	{
		return ready;
	}

	public static function preservesQueryExecutionStrategy():Bool
	{
		return WpdbQueryExecutionStrategy.ownsExecutionBody("query") && WpdbQueryExecutionStrategy.ownsExecutionBody("do_native_query");
	}

	public static function preservesMethodBodyStrategy():Bool
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
