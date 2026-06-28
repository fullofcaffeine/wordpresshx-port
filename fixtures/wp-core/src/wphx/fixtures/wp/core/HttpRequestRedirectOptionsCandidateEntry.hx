package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestRedirectOptions.shouldDisableRedirects;

/**
	Compile anchor for the WP_Http::request redirect options Haxe candidate.
**/
class HttpRequestRedirectOptionsCandidateEntry
{
	static function main():Void
	{
		shouldDisableRedirects(0);
	}
}
