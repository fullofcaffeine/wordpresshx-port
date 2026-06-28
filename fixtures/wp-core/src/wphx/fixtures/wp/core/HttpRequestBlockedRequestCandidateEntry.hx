package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestBlockedRequest.shouldReturnBlockedRequestError;

/**
	Compile anchor for the WP_Http::request blocked-request Haxe candidate.
**/
class HttpRequestBlockedRequestCandidateEntry
{
	static function main():Void
	{
		shouldReturnBlockedRequestError(true);
	}
}
