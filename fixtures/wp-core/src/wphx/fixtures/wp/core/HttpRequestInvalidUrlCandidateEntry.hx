package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestInvalidUrl.shouldRejectInvalidRequestUrl;

/**
	Compile anchor for the WP_Http::request invalid URL Haxe candidate.
**/
class HttpRequestInvalidUrlCandidateEntry
{
	static function main():Void
	{
		shouldRejectInvalidRequestUrl("relative/path", null);
	}
}
