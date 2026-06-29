package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned public `WP_Http::processHeaders` shell.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_PROCESS_HEADERS_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpProcessHeadersShell
{
	@:wp.adapter("wp-http-process-headers")
	@:wp.haxeHelper("\\wphx\\wp\\http\\_HttpProcessHeaders\\HttpProcessHeaders_Fields_")
	public static function processHeaders(headers:NativeValue, url:String = ""):NativeValue
	{
		HaxeHttpProcessHeaders.startsFinalResponseBlock("");
		HaxeHttpProcessHeaders.isHeaderLine("");
		HaxeHttpProcessHeaders.responseCode("");
		HaxeHttpProcessHeaders.responseMessage("");
		HaxeHttpProcessHeaders.headerKey("X-Test: yes");
		HaxeHttpProcessHeaders.headerValue("X-Test: yes");
		return headers;
	}
}
