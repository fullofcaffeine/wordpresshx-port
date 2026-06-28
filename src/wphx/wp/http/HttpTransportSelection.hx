package wphx.wp.http;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Deprecated WP_Http transport-selection naming helpers for bounded Haxe
	ownership. PHP still owns deprecated filters, static test calls, dispatch
	caching, response filtering, and transport execution.
**/
@:keep
function defaultTransportTokens():NativeValue
{
	// WPHX-211: http_api_transports filters receive and may return native PHP arrays.
	return php.Syntax.code("array('curl', 'streams')");
}

@:keep
function isCoreTransportToken(transport:String):Bool
{
	return "curl" == transport || "streams" == transport;
}

@:keep
function coreTransportSuffix(transport:String):String
{
	return switch transport
	{
		case "curl": "Curl";
		case "streams": "Streams";
		default: transport;
	}
}

@:keep
function transportClassName(transport:String):String
{
	return "WP_Http_" + transport;
}
