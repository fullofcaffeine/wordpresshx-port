package wphx.fixtures.compiler.php.feed;

import wphx.fixtures.compiler.php.feed.FeedModuleSurface.feedContentType;
import wphx.fixtures.compiler.php.feed.FeedModuleSurface.getDefaultFeed;

/**
	Compile anchor for original-path feed module function adapters.
**/
class FeedModuleEntry
{
	static function main():Void
	{
		getDefaultFeed();
		feedContentType("rss2");
	}
}
