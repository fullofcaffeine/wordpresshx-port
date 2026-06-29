package wphx.wp.http;

/**
	WP_Http::request successful response-object attachment decision for bounded
	Haxe ownership. PHP still owns Requests dispatch, wrapper construction,
	response array conversion, debug/filter timing, and public method ABI.
**/
@:keep
function shouldAttachHttpResponseObject():Bool
{
	return true;
}
