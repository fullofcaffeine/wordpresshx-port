package wphx.fixtures.wp.core;

import wphx.wp.http.HttpChunkTransferDecode.decodeChunkTransfer;
import wphx.wp.http.HttpDeprecatedParseUrl.deprecatedFunctionName;
import wphx.wp.http.HttpDeprecatedParseUrl.deprecatedVersion;
import wphx.wp.http.HttpDeprecatedParseUrl.parseUrl;
import wphx.wp.http.HttpDeprecatedParseUrl.replacementFunctionName;
import wphx.wp.http.HttpProcessResponse.responseBody;
import wphx.wp.http.HttpProcessResponse.responseHeaders;

/**
	Compile anchor for grouped WP_Http parser helper Haxe candidates.
**/
class HttpParserHelpersCandidateEntry
{
	static function main():Void
	{
		responseHeaders("HTTP/1.1 200 OK\r\n\r\nbody");
		responseBody("HTTP/1.1 200 OK\r\n\r\nbody");
		decodeChunkTransfer("4\r\nTest\r\n0");
		deprecatedFunctionName();
		deprecatedVersion();
		replacementFunctionName();
		parseUrl("https://example.test/");
	}
}
