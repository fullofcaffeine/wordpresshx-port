package wphx.fixtures.wp.core;

import wphx.wp.http.HttpDeprecatedParseUrl.deprecatedFunctionName;
import wphx.wp.http.HttpDeprecatedParseUrl.deprecatedVersion;
import wphx.wp.http.HttpDeprecatedParseUrl.parseUrl;
import wphx.wp.http.HttpDeprecatedParseUrl.replacementFunctionName;

/**
	Compile anchor for the WP_Http::parse_url deprecated-wrapper Haxe candidate.
**/
class HttpDeprecatedParseUrlCandidateEntry
{
	static function main():Void
	{
		deprecatedFunctionName();
		deprecatedVersion();
		replacementFunctionName();
		parseUrl("https://example.test/");
	}
}
