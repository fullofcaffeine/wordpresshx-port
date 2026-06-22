package wphx.wp.rest;

@:keep
class RestSettingsUpdateStrategy
{
	public static inline final ROUTE_TYPED_HAXE_UPDATE_PLAN = "typed_haxe_rest_settings_update_plan";
	public static inline final ROUTE_UNKNOWN = "unknown";

	public static function ownedControllerBodies():Array<String>
	{
		return ["update_item"];
	}

	public static function controllerBodyRoute(methodName:String):String
	{
		return contains(ownedControllerBodies(), methodName) ? ROUTE_TYPED_HAXE_UPDATE_PLAN : ROUTE_UNKNOWN;
	}

	public static function ownsControllerBody(methodName:String):Bool
	{
		return controllerBodyRoute(methodName) == ROUTE_TYPED_HAXE_UPDATE_PLAN;
	}

	public static function shouldSkipMissingRequestParam(paramPresent:Bool):Bool
	{
		return !paramPresent;
	}

	public static function shouldSkipAfterPreUpdate(preUpdateResult:Bool):Bool
	{
		return preUpdateResult;
	}

	public static function shouldDeleteOptionForNullValue(valueIsNull:Bool):Bool
	{
		return valueIsNull;
	}

	public static function shouldRejectNullForInvalidStoredValue(valueIsNull:Bool, storedValueValidationFailed:Bool):Bool
	{
		return valueIsNull && storedValueValidationFailed;
	}

	public static function shouldUpdateOptionForValue(valueIsNull:Bool):Bool
	{
		return !valueIsNull;
	}

	public static function shouldRefreshResponse():Bool
	{
		return true;
	}

	static function contains(values:Array<String>, value:String):Bool
	{
		for (entry in values)
		{
			if (entry == value)
			{
				return true;
			}
		}
		return false;
	}
}
