package wphx.fixtures.php.feed;

/**
	Compile anchor for the stock Haxe PHP feed helper implementation.
**/
class FeedImplEntry
{
	static function main():Void
	{
		FeedKernel.defaultFeed();
		FeedKernel.feedContentType("rss2");
	}
}
