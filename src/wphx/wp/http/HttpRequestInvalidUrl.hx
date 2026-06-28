package wphx.wp.http;

/**
	WP_Http::request invalid URL branch decision for bounded Haxe ownership. PHP
	still owns URL filtering, parse_url execution, WP_Error construction, debug
	hooks, block policy, and Requests dispatch.
**/
@:keep
function shouldRejectInvalidRequestUrl(url:String, scheme:Null<String>):Bool
{
	return url == "" || scheme == null || scheme == "";
}
