package wphx.wp.http;

/**
	WP_Http::request URL-safety option decisions for bounded Haxe ownership.
	PHP still owns filters, hook registration mechanics, validation execution,
	bad-protocol stripping, proxy handoff, and Requests dispatch.
**/
@:keep
function shouldRegisterRedirectValidation(badProtocolHelperExists:Bool, rejectUnsafeUrls:Bool):Bool
{
	return badProtocolHelperExists && rejectUnsafeUrls;
}
