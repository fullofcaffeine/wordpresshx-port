package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestPreemptiveResponse.shouldReturnPreemptiveResponse;

/**
	Compile anchor for the WP_Http::request preemptive response Haxe candidate.
**/
class HttpRequestPreemptiveResponseCandidateEntry
{
	static function main():Void
	{
		shouldReturnPreemptiveResponse(true);
	}
}
