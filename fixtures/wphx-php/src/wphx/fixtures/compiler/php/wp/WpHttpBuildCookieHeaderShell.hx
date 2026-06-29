package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned public `WP_Http::buildCookieHeader` shell.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_BUILD_COOKIE_HEADER_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpBuildCookieHeaderShell
{
	@:wp.adapter("wp-http-build-cookie-header")
	@:wp.haxeHelper("\\wphx\\wp\\http\\_HttpCookieHeaderAssembly\\HttpCookieHeaderAssembly_Fields_")
	public static function buildCookieHeader(@:wp.byRef r:NativeValue):Void
	{
		HaxeHttpCookieHeaderAssembly.appendCookieHeader("", "");
	}
}
