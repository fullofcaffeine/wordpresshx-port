package wphx.fixtures.php.feed;

/**
	Selected feed helper behavior owned by Haxe behind original-path PHP functions.
**/
@:keep
class FeedKernel
{
	public static function defaultFeed():String
	{
		final defaultFeed = WpHooks.applyFilters1("default_feed", "rss2");
		return defaultFeed == "rss" ? "rss2" : defaultFeed;
	}

	public static function feedContentType(type:Null<String>):String
	{
		final normalizedType = isPhpEmptyString(type) ? defaultFeed() : type;
		final contentType = switch (normalizedType)
		{
			case "rss" | "rss2":
				"application/rss+xml";
			case "rss-http":
				"text/xml";
			case "atom":
				"application/atom+xml";
			case "rdf":
				"application/rdf+xml";
			case _:
				"application/octet-stream";
		}
		return WpHooks.applyFilters2("feed_content_type", contentType, normalizedType);
	}

	static function isPhpEmptyString(value:Null<String>):Bool
	{
		return value == null || value == "" || value == "0";
	}
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class WpHooks
{
	@:native("apply_filters")
	public static function applyFilters1(hookName:String, value:String):String;

	@:native("apply_filters")
	public static function applyFilters2(hookName:String, value:String, arg:String):String;
}
