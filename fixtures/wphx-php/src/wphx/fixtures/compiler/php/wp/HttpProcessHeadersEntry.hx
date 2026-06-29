package wphx.fixtures.compiler.php.wp;

/**
	Compile anchor for the compiler-emitted WP_Http::processHeaders shell.
**/
class HttpProcessHeadersEntry
{
	static function main():Void
	{
		WpHttpProcessHeadersShell.processHeaders("", "");
	}
}
