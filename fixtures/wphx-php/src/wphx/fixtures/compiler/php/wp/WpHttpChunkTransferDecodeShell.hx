package wphx.fixtures.compiler.php.wp;

/**
	Compiler-owned public `WP_Http` shell for the chunkTransferDecode driver.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_CHUNK_TRANSFER_DECODE_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpChunkTransferDecodeShell
{
	public static function chunkTransferDecode(body:String):String
	{
		return HaxeHttpChunkTransferDecode.decodeChunkTransfer(body);
	}
}
