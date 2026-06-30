package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned bounded `WP_Http` shell for deprecated transport selection.

	The public `_get_first_available_transport()` ABI and private
	`_dispatch_request()` reflection shape are emitted at the original
	`class-wp-http.php` path. Haxe owns only transport token/class-name mapping;
	PHP keeps deprecated filter timing, transport tests, dispatch caching,
	debug/filter side effects, and `WP_Error` construction.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_TRANSPORT_SELECTION_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpTransportSelectionShell
{
	public function new():Void {}

	@:wp.adapter("wp-http-transport-get-first-available")
	@:wp.haxeHelper("\\wphx\\wp\\http\\_HttpTransportSelection\\HttpTransportSelection_Fields_")
	public function _get_first_available_transport(args:NativeValue, url:NativeValue = null):NativeValue
	{
		HaxeHttpTransportSelection.defaultTransportTokens();
		return null;
	}

	@:wp.visibility("private")
	@:wp.adapter("wp-http-transport-dispatch-request")
	function _dispatch_request(url:String, args:NativeValue):NativeValue
	{
		return null;
	}
}
