package wphx.wp.http;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	WP_Http::parse_url deprecated-wrapper metadata and delegation for bounded
	Haxe ownership. PHP still owns the protected static ABI, deprecation dispatch,
	and native wp_parse_url result shape.
**/
@:keep
function deprecatedFunctionName():String
{
	return "WP_Http::parse_url";
}

@:keep
function deprecatedVersion():String
{
	return "4.4.0";
}

@:keep
function replacementFunctionName():String
{
	return "wp_parse_url()";
}

@:keep
function parseUrl(url:String):NativeValue
{
	// WPHX-211: wp_parse_url returns native PHP false-or-array component values.
	return php.Syntax.code("wp_parse_url({0})", url);
}
