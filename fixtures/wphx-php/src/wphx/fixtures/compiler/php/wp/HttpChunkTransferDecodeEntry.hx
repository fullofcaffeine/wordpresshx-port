package wphx.fixtures.compiler.php.wp;

/**
	Compile anchor for the compiler-emitted WP_Http::chunkTransferDecode shell.
**/
class HttpChunkTransferDecodeEntry
{
	static function main():Void
	{
		WpHttpChunkTransferDecodeShell.chunkTransferDecode("4\r\nTest\r\n0");
	}
}
