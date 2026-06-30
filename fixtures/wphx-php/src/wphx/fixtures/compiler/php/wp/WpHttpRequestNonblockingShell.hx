package wphx.fixtures.compiler.php.wp;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned bounded `WP_Http::request` public shell for the nonblocking
	response shape. PHP keeps request orchestration; Haxe owns only the
	`blocking=false` response array helper for this slice.
**/
@:wp.file("wp-includes/class-wp-http.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_REQUEST_NONBLOCKING_BOOTSTRAPPED")
@:native("WP_Http")
@:keep
class WpHttpRequestNonblockingShell
{
	public function new():Void {}

	@:wp.adapter("wp-http-request-nonblocking")
	@:wp.haxeHelper("\\wphx\\wp\\http\\_HttpRequestNonblocking\\HttpRequestNonblocking_Fields_")
	@:wp.haxeHelper("safetyOptions", "\\wphx\\wp\\http\\_HttpRequestSafetyOptions\\HttpRequestSafetyOptions_Fields_")
	@:wp.haxeHelper("streamBlocking", "\\wphx\\wp\\http\\_HttpRequestStreamBlocking\\HttpRequestStreamBlocking_Fields_")
	public function request(url:String, @:wp.defaultArray args:NativeValue = null):NativeValue
	{
		return HaxeHttpRequestNonblocking.nonblockingResponse();
	}

	@:wp.adapter("wp-http-block-request")
	@:wp.haxeHelper("\\wphx\\wp\\http\\_HttpBlockRequestPolicy\\HttpBlockRequestPolicy_Fields_")
	public function block_request(uri:String):NativeValue
	{
		return HaxeHttpBlockRequestPolicy.isLocalRequest(uri, "");
	}
}
