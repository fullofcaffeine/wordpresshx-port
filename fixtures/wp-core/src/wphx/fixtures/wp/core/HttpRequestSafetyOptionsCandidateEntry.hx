package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRequestSafetyOptions.shouldRegisterRedirectValidation;

/**
	Compile anchor for the WP_Http::request URL-safety options Haxe candidate.
**/
class HttpRequestSafetyOptionsCandidateEntry
{
	static function main():Void
	{
		shouldRegisterRedirectValidation(true, true);
	}
}
