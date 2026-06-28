package wphx.wp.http;

/**
	WP_Http::request proxy option branch decision for bounded Haxe ownership.
	PHP still owns WP_HTTP_Proxy policy, filters, proxy object construction,
	authentication handoff, Requests dispatch, and live proxy behavior.
**/
@:keep
function shouldUseProxy(proxyEnabled:Bool, sendThroughProxy:Bool):Bool
{
	return proxyEnabled && sendThroughProxy;
}
