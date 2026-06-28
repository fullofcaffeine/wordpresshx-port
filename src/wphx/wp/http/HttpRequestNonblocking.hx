package wphx.wp.http;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	WP_Http::request nonblocking response shape for bounded Haxe ownership.
	PHP still owns request orchestration, Requests dispatch, debug hooks,
	error conversion, and the public method ABI.
**/
@:keep
function nonblockingResponse():NativeValue
{
	// WPHX-211: WP_Http public responses require native PHP arrays with false/null leaves.
	return
		php.Syntax.code("array('headers' => array(), 'body' => '', 'response' => array('code' => false, 'message' => false), 'cookies' => array(), 'http_response' => null)");
}
