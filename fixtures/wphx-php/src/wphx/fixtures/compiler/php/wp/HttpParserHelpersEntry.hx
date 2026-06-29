package wphx.fixtures.compiler.php.wp;

/**
	Compile anchor for grouped WP_Http parser helper public shell emission.
**/
class HttpParserHelpersEntry
{
	static function main():Void
	{
		WpHttpParserHelpersShell.processResponse("HTTP/1.1 200 OK\r\n\r\nbody");
		WpHttpParserHelpersShell.chunkTransferDecode("4\r\nTest\r\n0");
	}
}
