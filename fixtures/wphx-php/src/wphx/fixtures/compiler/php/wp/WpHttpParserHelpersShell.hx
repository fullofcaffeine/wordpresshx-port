package wphx.fixtures.compiler.php.wp;

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
}
