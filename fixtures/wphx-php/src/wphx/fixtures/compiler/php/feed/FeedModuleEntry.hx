package wphx.fixtures.compiler.php.feed;

import wphx.fixtures.compiler.php.feed.FeedModuleSurface.feedContentType;
import wphx.fixtures.compiler.php.feed.FeedModuleSurface.getBloginfoRss;
import wphx.fixtures.compiler.php.feed.FeedModuleSurface.getDefaultFeed;
import wphx.fixtures.compiler.php.feed.FeedModuleSurface.getTheTitleRss;

/**
	Compile anchor for original-path feed module function adapters.
**/
class FeedModuleEntry
{
	static function main():Void
	{
		getBloginfoRss("name");
		getDefaultFeed();
		getTheTitleRss(0);
		feedContentType("rss2");
	}
}
