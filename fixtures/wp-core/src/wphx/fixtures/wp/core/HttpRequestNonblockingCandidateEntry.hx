package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestNonblocking.nonblockingResponse;
import wphx.wp.http.HttpBlockRequestPolicy.isLocalRequest;
import wphx.wp.http.HttpBlockRequestPolicy.shouldBlockExternalHost;

/**
	Compile anchor for the WP_Http::request nonblocking response Haxe candidate.
**/
class HttpRequestNonblockingCandidateEntry
{
	static function main():Void
	{
		nonblockingResponse();
		isLocalRequest("localhost", "example.test");
		shouldBlockExternalHost("blocked.example", "example.test");
	}
}
