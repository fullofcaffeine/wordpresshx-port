package wphx.wp.http;

import wphx.wp.boundary.NativeValue.NativeValue;

using StringTools;

@:keep
function test(cookie:NativeValue, url:String):Bool
{
	if (PhpObject.isNullProperty(cookie, "name"))
	{
		return false;
	}

	if (PhpObject.issetProperty(cookie, "expires") && PhpTime.now() > PhpObject.getPropertyInt(cookie, "expires"))
	{
		return false;
	}

	final parsedUrl = PhpUrl.parse(url);
	final scheme = PhpArray.getString(parsedUrl, "scheme", "");
	final requestHost = PhpArray.getString(parsedUrl, "host", "");
	final requestPort = PhpArray.hasKey(parsedUrl, "port") ? PhpArray.getInt(parsedUrl, "port", 0) : (scheme == "https" ? 443 : 80);
	final requestPath = PhpArray.getString(parsedUrl, "path", "/");

	final path = PhpObject.issetProperty(cookie, "path") ? PhpObject.getPropertyString(cookie, "path") : "/";
	final port = PhpObject.issetProperty(cookie, "port") ? PhpObject.getPropertyString(cookie, "port") : "";
	var domain = PhpObject.issetProperty(cookie, "domain") ? PhpString.lower(PhpObject.getPropertyString(cookie, "domain")) : PhpString.lower(requestHost);
	if (PhpString.stripos(domain, ".") == false)
	{
		domain += ".local";
	}

	if (domain.startsWith("."))
	{
		domain = domain.substr(1);
	}
	if (!requestHost.endsWith(domain))
	{
		return false;
	}

	if (port != "" && !portListContains(port, requestPort))
	{
		return false;
	}

	return requestPath.startsWith(path);
}

@:keep
function hasHeaderFields(cookie:NativeValue):Bool
{
	return PhpObject.issetProperty(cookie, "name") && PhpObject.issetProperty(cookie, "value");
}

@:keep
function headerValue(cookie:NativeValue, filteredValue:NativeValue):String
{
	return PhpObject.getPropertyString(cookie, "name") + "=" + PhpValue.toString(filteredValue);
}

@:keep
function fullHeader(headerValue:String):String
{
	return "Cookie: " + headerValue;
}

@:keep
function attributes(cookie:NativeValue):php.NativeArray
{
	return PhpArray.literalAttributes(PhpObject.getProperty(cookie, "expires"), PhpObject.getProperty(cookie, "path"), PhpObject.getProperty(cookie, "domain"));
}

function portListContains(portList:String, requestPort:Int):Bool
{
	for (port in portList.split(","))
	{
		if (Std.parseInt(port) == requestPort)
		{
			return true;
		}
	}
	return false;
}

@:keep
class PhpObject
{
	// WPHX-211: WP_Http_Cookie exposes public PHP properties with null/isset ABI semantics.
	public static function isNullProperty(object:NativeValue, property:String):Bool
	{
		return php.Syntax.code("is_null({0}->{1})", object, property);
	}

	// WPHX-211: isset preserves PHP's null-aware public-property behavior.
	public static function issetProperty(object:NativeValue, property:String):Bool
	{
		return php.Syntax.code("isset({0}->{1})", object, property);
	}

	// WPHX-211: public cookie properties can be strings, ints, bools, or dynamic attributes.
	public static function getProperty(object:NativeValue, property:String):NativeValue
	{
		return php.Syntax.code("{0}->{1}", object, property);
	}

	// WPHX-211: native PHP string coercion is required for public cookie properties.
	public static function getPropertyString(object:NativeValue, property:String):String
	{
		return php.Syntax.code("(string) {0}->{1}", object, property);
	}

	// WPHX-211: native PHP int coercion is required for expires comparisons.
	public static function getPropertyInt(object:NativeValue, property:String):Int
	{
		return php.Syntax.code("(int) {0}->{1}", object, property);
	}
}

@:keep
class PhpArray
{
	// WPHX-211: parse_url returns a native PHP associative array.
	public static function hasKey(array:php.NativeArray, key:String):Bool
	{
		return php.Syntax.code("array_key_exists({0}, {1})", key, array);
	}

	// WPHX-211: native array lookup preserves PHP parse_url component types.
	public static function getString(array:php.NativeArray, key:String, defaultValue:String):String
	{
		return hasKey(array, key) ? php.Syntax.code("(string) {0}[{1}]", array, key) : defaultValue;
	}

	// WPHX-211: native array lookup preserves PHP parse_url port integer values.
	public static function getInt(array:php.NativeArray, key:String, defaultValue:Int):Int
	{
		return hasKey(array, key) ? php.Syntax.code("(int) {0}[{1}]", array, key) : defaultValue;
	}

	// WPHX-211: get_attributes must return a native PHP associative array with WordPress key order.
	public static function literalAttributes(expires:NativeValue, path:NativeValue, domain:NativeValue):php.NativeArray
	{
		return php.Syntax.code("array('expires' => {0}, 'path' => {1}, 'domain' => {2})", expires, path, domain);
	}
}

@:keep
class PhpString
{
	// WPHX-211: strtolower preserves PHP locale/runtime string behavior at the public boundary.
	public static function lower(value:String):String
	{
		return php.Syntax.code("strtolower({0})", value);
	}

	// WPHX-211: PHP stripos returns false-or-int and WordPress compares it strictly to false here.
	public static function stripos(haystack:String, needle:String):Dynamic
	{
		return php.Syntax.code("stripos({0}, {1})", haystack, needle);
	}
}

@:keep
class PhpTime
{
	// WPHX-211: cookie expiry checks use PHP's current Unix timestamp.
	public static function now():Int
	{
		return php.Syntax.code("time()");
	}
}

@:keep
class PhpUrl
{
	// WPHX-211: URL parsing follows PHP parse_url behavior used by WordPress.
	public static function parse(url:String):php.NativeArray
	{
		return php.Syntax.code("parse_url({0})", url);
	}
}

@:keep
class PhpValue
{
	// WPHX-211: filter return values are PHP-native values coerced into header strings.
	public static function toString(value:NativeValue):String
	{
		return php.Syntax.code("(string) {0}", value);
	}
}
