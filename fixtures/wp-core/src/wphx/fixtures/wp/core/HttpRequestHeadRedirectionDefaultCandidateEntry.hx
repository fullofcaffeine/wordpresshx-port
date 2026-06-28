package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestHeadRedirectionDefault.shouldDisableHeadDefaultRedirection;

/**
	Compile anchor for the WP_Http::request HEAD redirection default candidate.
**/
class HttpRequestHeadRedirectionDefaultCandidateEntry
{
	static function main():Void
	{
		shouldDisableHeadDefaultRedirection(true, "HEAD");
	}
}
