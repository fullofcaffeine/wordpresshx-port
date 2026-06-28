package wphx.wp.http;

/**
	WP_Http::request redirect option decisions for bounded Haxe ownership.
	PHP still owns redirection defaults/filters, option-array mutation, Requests
	dispatch, and actual redirect following.
**/
@:keep
function shouldDisableRedirects(redirection:Int):Bool
{
	return 0 == redirection;
}
