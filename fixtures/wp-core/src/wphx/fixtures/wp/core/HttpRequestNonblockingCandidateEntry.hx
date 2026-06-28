package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestNonblocking.nonblockingResponse;

/**
	Compile anchor for the WP_Http::request nonblocking response Haxe candidate.
**/
class HttpRequestNonblockingCandidateEntry
{
	static function main():Void
	{
		nonblockingResponse();
	}
}
