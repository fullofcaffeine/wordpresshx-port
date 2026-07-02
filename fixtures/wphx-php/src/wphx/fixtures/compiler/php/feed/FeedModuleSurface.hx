package wphx.fixtures.compiler.php.feed;

/**
	Selected unguarded WordPress feed.php module functions emitted at the original path.
**/
@:wp.file("wp-includes/feed.php")
@:wp.haxeBootstrap("WPHX_FEED_MODULE_BOOTSTRAPPED")
@:wp.global("get_default_feed")
@:keep
function getDefaultFeed():String
{
	return HaxeFeedKernel.defaultFeed();
}

@:wp.file("wp-includes/feed.php")
@:wp.haxeBootstrap("WPHX_FEED_MODULE_BOOTSTRAPPED")
@:wp.global("feed_content_type")
@:keep
function feedContentType(@:wp.name("type") type:Null<String> = ""):String
{
	return HaxeFeedKernel.feedContentType(type);
}
