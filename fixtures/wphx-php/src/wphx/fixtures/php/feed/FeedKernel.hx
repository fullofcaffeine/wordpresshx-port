package wphx.fixtures.php.feed;

/**
	Selected feed helper behavior owned by Haxe behind original-path PHP functions.
**/
@:keep
class FeedKernel
{
	public static function getBloginfoRss(show:String):String
	{
		final info = WpFeedGlobals.stripTags(WpFeedGlobals.getBloginfo(show));
		return WpHooks.applyFilters2("get_bloginfo_rss", WpFeedGlobals.convertChars(info), show);
	}

	public static function defaultFeed():String
	{
		final defaultFeed = WpHooks.applyFilters1("default_feed", "rss2");
		return defaultFeed == "rss" ? "rss2" : defaultFeed;
	}

	public static function getTheTitleRss(post:Int):String
	{
		final title = WpFeedGlobals.getTheTitle(post);
		return WpHooks.applyFilters1("the_title_rss", title);
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
	Narrow externs for WordPress feed helper calls preserved at the PHP boundary.
**/
@:phpGlobal
extern class WpFeedGlobals
{
	@:native("strip_tags")
	public static function stripTags(value:String):String;

	@:native("get_bloginfo")
	public static function getBloginfo(show:String):String;

	@:native("convert_chars")
	public static function convertChars(value:String):String;

	@:native("get_the_title")
	public static function getTheTitle(post:Int):String;
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
