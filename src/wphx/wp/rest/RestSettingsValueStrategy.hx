package wphx.wp.rest;

@:keep
class RestSettingsValueStrategy
{
	public static inline final ROUTE_TYPED_HAXE_VALUE_PLAN = "typed_haxe_rest_settings_value_plan";
	public static inline final ROUTE_UNKNOWN = "unknown";

	public static function ownedControllerBodies():Array<String>
	{
		return ["get_item", "prepare_value"];
	}

	public static function controllerBodyRoute(methodName:String):String
	{
		return contains(ownedControllerBodies(), methodName) ? ROUTE_TYPED_HAXE_VALUE_PLAN : ROUTE_UNKNOWN;
	}

	public static function ownsControllerBody(methodName:String):Bool
	{
		return controllerBodyRoute(methodName) == ROUTE_TYPED_HAXE_VALUE_PLAN;
	}

	public static function shouldUseOptionFallback(preGetValueIsNull:Bool):Bool
	{
		return preGetValueIsNull;
	}

	public static function shouldReturnNullForInvalidSchemaValue(validationFailed:Bool):Bool
	{
		return validationFailed;
	}

	public static function shouldSanitizeSchemaValue(validationFailed:Bool):Bool
	{
		return !validationFailed;
	}

	public static function shouldPreserveNullSanitizeInput(valueIsNull:Bool):Bool
	{
		return valueIsNull;
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
