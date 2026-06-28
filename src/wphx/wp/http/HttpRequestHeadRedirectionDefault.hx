package wphx.wp.http;

/**
	WP_Http::request HEAD redirection default decision for bounded Haxe
	ownership. PHP still owns wp_parse_args, defaults/filters, parsed args,
	Requests option handoff, and dispatch.
**/
@:keep
function shouldDisableHeadDefaultRedirection(methodIsSet:Bool, method:String):Bool
{
	return methodIsSet && "HEAD" == method;
}
