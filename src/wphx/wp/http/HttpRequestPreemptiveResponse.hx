package wphx.wp.http;

/**
	WP_Http::request preemptive response branch decision for bounded Haxe
	ownership. PHP still owns the filter call, returned value shape, URL handling,
	error construction, and Requests dispatch.
**/
@:keep
function shouldReturnPreemptiveResponse(hasPreemptiveResponse:Bool):Bool
{
	return hasPreemptiveResponse;
}
