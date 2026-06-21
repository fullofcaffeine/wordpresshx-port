package wphx.wp.db;

@:keep
class WpdbPublicStateStorageAdapter
{
	public static inline final DEFAULT_KIND_BOOL = "bool";
	public static inline final DEFAULT_KIND_INT = "int";
	public static inline final DEFAULT_KIND_NATIVE_PHP_ARRAY = "native_php_array";
	public static inline final DEFAULT_KIND_NULL = "null";
	public static inline final DEFAULT_KIND_STRING = "string";
	public static inline final DEFAULT_KIND_UNKNOWN = "unknown";

	public static inline final WRITE_ROUTE_DIRECT_PUBLIC_PHP_PROPERTY = "direct_public_php_property";
	public static inline final WRITE_ROUTE_DYNAMIC_PHP_PROPERTY = "dynamic_php_property";
	public static inline final WRITE_ROUTE_MAGIC_STORAGE = "magic_storage";
	public static inline final WRITE_ROUTE_PROTECTED_MAGIC_BLOCK = "protected_magic_write_block";
	public static inline final WRITE_ROUTE_UNKNOWN = "unknown";

	public static function selectedPublicStorageProperties():Array<String>
	{
		return [
			"field_types",
			"insert_id",
			"last_error",
			"last_query",
			"last_result",
			"num_rows",
			"prefix",
			"ready",
			"rows_affected"
		];
	}

	public static function selectedMagicStorageProperties():Array<String>
	{
		return [
			"checking_collation",
			"dbhost",
			"dbname",
			"dbpassword",
			"dbuser",
			"has_connected",
			"use_mysqli"
		];
	}

	public static function shouldInitializePublicProperty(name:String):Bool
	{
		return contains(selectedPublicStorageProperties(), name);
	}

	public static function shouldRoutePublicWriteToPhpProperty(name:String):Bool
	{
		return WpdbPublicStateDescriptor.hasDeclaredPublicProperty(name);
	}

	public static function shouldRouteDynamicWriteToPhpProperty(name:String):Bool
	{
		return WpdbPublicStateDescriptor.dynamicPropertiesAllowed()
			&& !WpdbPublicStateDescriptor.hasDeclaredPublicProperty(name)
			&& !WpdbPublicStateDescriptor.hasMagicVisibleInternalProperty(name);
	}

	public static function shouldRouteMagicReadToStorage(name:String):Bool
	{
		return contains(selectedMagicStorageProperties(), name);
	}

	public static function shouldRouteMagicWriteToStorage(name:String):Bool
	{
		return shouldRouteMagicReadToStorage(name) && !shouldBlockMagicWrite(name);
	}

	public static function shouldBlockMagicWrite(name:String):Bool
	{
		return WpdbPublicStateDescriptor.blocksMagicWrite(name);
	}

	public static function writeRoute(name:String):String
	{
		if (shouldBlockMagicWrite(name))
		{
			return WRITE_ROUTE_PROTECTED_MAGIC_BLOCK;
		}
		if (shouldRouteMagicWriteToStorage(name))
		{
			return WRITE_ROUTE_MAGIC_STORAGE;
		}
		if (shouldRoutePublicWriteToPhpProperty(name))
		{
			return WRITE_ROUTE_DIRECT_PUBLIC_PHP_PROPERTY;
		}
		if (shouldRouteDynamicWriteToPhpProperty(name))
		{
			return WRITE_ROUTE_DYNAMIC_PHP_PROPERTY;
		}
		return WRITE_ROUTE_UNKNOWN;
	}

	public static function publicDefaultKind(name:String):String
	{
		return switch name
		{
			case "field_types":
				DEFAULT_KIND_NATIVE_PHP_ARRAY;
			case "insert_id" | "num_rows" | "rows_affected":
				DEFAULT_KIND_INT;
			case "last_error" | "prefix":
				DEFAULT_KIND_STRING;
			case "ready":
				DEFAULT_KIND_BOOL;
			case "last_query" | "last_result":
				DEFAULT_KIND_NULL;
			case _:
				DEFAULT_KIND_UNKNOWN;
		}
	}

	public static function publicStringDefault(name:String):Null<String>
	{
		return switch name
		{
			case "last_error" | "prefix":
				"";
			case _:
				null;
		}
	}

	public static function publicIntDefault(name:String):Null<Int>
	{
		return switch name
		{
			case "insert_id" | "num_rows" | "rows_affected":
				0;
			case _:
				null;
		}
	}

	public static function publicBoolDefault(name:String):Null<Bool>
	{
		return switch name
		{
			case "ready":
				false;
			case _:
				null;
		}
	}

	public static function publicNativeArrayDefaultIsEmpty(name:String):Bool
	{
		return name == "field_types";
	}

	public static function magicDefaultKind(name:String):String
	{
		return switch name
		{
			case "checking_collation" | "has_connected" | "use_mysqli":
				DEFAULT_KIND_BOOL;
			case "dbhost" | "dbname" | "dbpassword" | "dbuser":
				DEFAULT_KIND_NULL;
			case _:
				DEFAULT_KIND_UNKNOWN;
		}
	}

	public static function magicStringDefault(name:String):Null<String>
	{
		return null;
	}

	public static function magicBoolDefault(name:String):Null<Bool>
	{
		return switch name
		{
			case "checking_collation" | "has_connected":
				false;
			case "use_mysqli":
				true;
			case _:
				null;
		}
	}

	public static function fieldTypesDirectMutationAllowed():Bool
	{
		return shouldRoutePublicWriteToPhpProperty("field_types");
	}

	public static function dynamicPluginPropertyAllowed():Bool
	{
		return shouldRouteDynamicWriteToPhpProperty("wphx_plugin_extension");
	}

	public static function preservesDbDropinReplacement():Bool
	{
		return WpdbPublicStateDescriptor.preservesDbDropinReplacement() && WpdbPublicStateDescriptor.requireWpDbReturnsWhenGlobalIsSet();
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
