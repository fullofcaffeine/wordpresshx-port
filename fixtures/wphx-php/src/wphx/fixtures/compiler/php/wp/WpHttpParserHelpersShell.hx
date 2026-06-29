package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

typedef ProcessResponseResult =
{
	final headers:String;
	final body:String;
};

/**
	Compiler-owned public `WP_Http` shell for grouped parser helpers.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_PARSER_HELPERS_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpParserHelpersShell
{
	public static function processResponse(response:String):ProcessResponseResult
	{
		return {
			headers: HaxeHttpProcessResponse.responseHeaders(response),
			body: HaxeHttpProcessResponse.responseBody(response)
		};
	}

	public static function chunkTransferDecode(body:String):String
	{
		return HaxeHttpChunkTransferDecode.decodeChunkTransfer(body);
	}

	@:wp.visibility("protected")
	public static function parse_url(url:String):NativeValue
	{
		PhpHttpGlobals.deprecatedFunction(HaxeHttpDeprecatedParseUrl.deprecatedFunctionName(), HaxeHttpDeprecatedParseUrl.deprecatedVersion(),
			HaxeHttpDeprecatedParseUrl.replacementFunctionName());
		return HaxeHttpDeprecatedParseUrl.parseUrl(url);
	}
}
