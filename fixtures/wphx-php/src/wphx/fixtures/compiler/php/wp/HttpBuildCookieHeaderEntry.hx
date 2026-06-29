package wphx.fixtures.compiler.php.wp;

/**
	Compile anchor for the compiler-emitted WP_Http::buildCookieHeader shell.
**/
class HttpBuildCookieHeaderEntry
{
	static function main():Void
	{
		// WPHX-211: compile anchor only; runtime PHP receives a native by-ref request array from the probe.
		WpHttpBuildCookieHeaderShell.buildCookieHeader(cast null);
	}
}
