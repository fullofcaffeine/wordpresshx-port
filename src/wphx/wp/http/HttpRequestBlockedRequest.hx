package wphx.wp.http;

/**
	WP_Http::request blocked-request branch decision for bounded Haxe ownership.
	PHP still owns block_request execution, policy checks, WP_Error construction,
	debug hooks, and Requests dispatch.
**/
@:keep
function shouldReturnBlockedRequestError(blocked:Bool):Bool
{
	return blocked;
}
