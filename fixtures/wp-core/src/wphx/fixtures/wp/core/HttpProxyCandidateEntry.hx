package wphx.fixtures.wp.core;

import wphx.wp.http.HttpProxyStrategy;

class HttpProxyCandidateEntry
{
	static function main():Void
	{
		HttpProxyStrategy.shouldSendThroughProxy("external.example.test", "site.example.test", "");
		HttpProxyStrategy.shouldSendThroughProxy("downloads.wordpress.org", "site.example.test", "*.wordpress.org");
	}
}
