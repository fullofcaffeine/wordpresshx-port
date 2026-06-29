package wphx.fixtures.compiler.php.wp;

/**
	Compile anchor for the compiler-emitted WP_Http::buildCookieHeader shell.
**/
class HttpBuildCookieHeaderEntry
{
	static function main():Void
	{
		WpHttpBuildCookieHeaderShell.buildCookieHeader(cast null);
	}
}
