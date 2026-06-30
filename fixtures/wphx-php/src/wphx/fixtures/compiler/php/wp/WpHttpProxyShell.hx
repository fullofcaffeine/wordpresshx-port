package wphx.fixtures.compiler.php.wp;

/**
	Compiler-owned public `WP_HTTP_Proxy` shell.

	The public class preserves WordPress' original-path proxy ABI while
	delegating only the post-filter bypass routing predicate to Haxe-owned
	source. PHP keeps constants, URL parsing, option lookup, filter timing, and
	authentication header encoding at the public boundary.
**/
@:wp.file("wp-includes/class-wp-http-proxy.php")
@:wp.haxeBootstrap("WPHX_WP_HTTP_PROXY_BOOTSTRAPPED")
@:wp.allowDynamicProperties
@:native("WP_HTTP_Proxy")
@:keep
class WpHttpProxyShell
{
	@:wp.adapter("wp-http-proxy-is-enabled")
	public function is_enabled():Bool
	{
		return false;
	}

	@:wp.adapter("wp-http-proxy-use-authentication")
	public function use_authentication():Bool
	{
		return false;
	}

	@:wp.adapter("wp-http-proxy-constant")
	public function host():String
	{
		return "";
	}

	@:wp.adapter("wp-http-proxy-constant")
	public function port():String
	{
		return "";
	}

	@:wp.adapter("wp-http-proxy-constant")
	public function username():String
	{
		return "";
	}

	@:wp.adapter("wp-http-proxy-constant")
	public function password():String
	{
		return "";
	}

	@:wp.adapter("wp-http-proxy-authentication")
	public function authentication():String
	{
		return username() + ":" + password();
	}

	@:wp.adapter("wp-http-proxy-authentication-header")
	public function authentication_header():String
	{
		return authentication();
	}

	@:wp.adapter("wp-http-proxy-send-through-proxy")
	@:wp.haxeHelper("\\wphx\\wp\\http\\HttpProxyStrategy")
	public function send_through_proxy(uri:String):Bool
	{
		return HaxeHttpProxyStrategy.shouldSendThroughProxy("", "", "");
	}
}
