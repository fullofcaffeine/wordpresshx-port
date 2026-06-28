package wphx.wp.http;

/**
	WP_Http redirect-following branch decisions that can be owned in Haxe while
	the public PHP shell still preserves native headers, cookies, errors, and dispatch.
**/
@:keep
function shouldShortCircuit(hasLocation:Bool, requestedRedirections:Int, responseCode:Int):Bool
{
	return !hasLocation || requestedRedirections == 0 || responseCode > 399 || responseCode < 300;
}

@:keep
function isTooManyRedirects(remainingRedirections:Int):Bool
{
	return remainingRedirections <= 0;
}

@:keep
function shouldSwitchPostRedirectToGet(method:String, responseCode:Int):Bool
{
	return method == "POST" && (responseCode == 302 || responseCode == 303);
}
