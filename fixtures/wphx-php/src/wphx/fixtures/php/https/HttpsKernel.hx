package wphx.fixtures.php.https;

import wphx.wp.boundary.NativeArray as WpNativeArray;
import wphx.wp.boundary.NativeValue.NativeValue;

using StringTools;

/**
	Selected HTTPS detection and migration behavior behind original-path PHP functions.
**/
@:keep
class HttpsKernel
{
	public static function isUsingHttps():Bool
	{
		if (!isHomeUrlUsingHttps())
		{
			return false;
		}

		return isSiteUrlUsingHttps();
	}

	public static function isHomeUrlUsingHttps():Bool
	{
		return urlPart(HttpsGlobals.homeUrl(), "scheme") == "https";
	}

	public static function isSiteUrlUsingHttps():Bool
	{
		final siteUrl = HttpsHooks.applyFiltersSiteUrl("site_url", HttpsGlobals.getOption("siteurl"), "", null, null);
		return urlPart(HttpsGlobals.strval(siteUrl), "scheme") == "https";
	}

	public static function isHttpsSupported():Bool
	{
		// WPHX-211: wp_get_https_detection_errors() returns WP_Error::$errors as a native PHP array.
		final errors:php.NativeArray = cast getHttpsDetectionErrors();
		return WpNativeArray.count(errors) == 0;
	}

	public static function getHttpsDetectionErrors():NativeValue
	{
		final preErrors = HttpsHooks.applyFiltersNative1("pre_wp_get_https_detection_errors", null);
		if (HttpsGlobals.isWpError(preErrors))
		{
			return existingWpError(preErrors).errors;
		}

		final supportErrors = new WpError();
		var response = HttpsGlobals.wpRemoteRequest(HttpsGlobals.homeUrlWithScheme("/", "https"), remoteRequestArgs(true));
		if (HttpsGlobals.isWpError(response))
		{
			final unverifiedResponse = HttpsGlobals.wpRemoteRequest(HttpsGlobals.homeUrlWithScheme("/", "https"), remoteRequestArgs(false));
			if (HttpsGlobals.isWpError(unverifiedResponse))
			{
				supportErrors.add("https_request_failed", HttpsGlobals.translate("HTTPS request failed."));
			} else
			{
				supportErrors.add("ssl_verification_failed", HttpsGlobals.translate("SSL verification failed."));
			}
			response = unverifiedResponse;
		}

		if (!HttpsGlobals.isWpError(response))
		{
			if (HttpsGlobals.wpRemoteRetrieveResponseCode(response) != 200)
			{
				supportErrors.add("bad_response_code", HttpsGlobals.wpRemoteRetrieveResponseMessage(response));
			} else if (strictFalse(isLocalHtmlOutput(HttpsGlobals.wpRemoteRetrieveBody(response))))
			{
				supportErrors.add("bad_response_source", HttpsGlobals.translate("It looks like the response did not come from this site."));
			}
		}

		return supportErrors.errors;
	}

	public static function shouldReplaceInsecureHomeUrl():Bool
	{
		final shouldReplace = isUsingHttps()
			&& HttpsGlobals.truthy(HttpsGlobals.getOption("https_migration_required"))
			&& urlPart(HttpsGlobals.homeUrl(), "host") == urlPart(HttpsGlobals.siteUrl(), "host");

		return HttpsHooks.applyFiltersBool("wp_should_replace_insecure_home_url", shouldReplace);
	}

	public static function replaceInsecureHomeUrl(content:String):String
	{
		if (!shouldReplaceInsecureHomeUrl())
		{
			return content;
		}

		final httpsUrl = HttpsGlobals.homeUrlWithScheme("", "https");
		final httpUrl = HttpsGlobals.strReplace("https://", "http://", httpsUrl);
		final escapedHttpsUrl = HttpsGlobals.strReplace("/", "\\/", httpsUrl);
		final escapedHttpUrl = HttpsGlobals.strReplace("/", "\\/", httpUrl);

		return HttpsGlobals.strReplace(escapedHttpUrl, escapedHttpsUrl, HttpsGlobals.strReplace(httpUrl, httpsUrl, content));
	}

	public static function updateUrlsToHttps():Bool
	{
		final origHome = HttpsGlobals.strval(HttpsGlobals.getOption("home"));
		final origSiteUrl = HttpsGlobals.strval(HttpsGlobals.getOption("siteurl"));
		final home = HttpsGlobals.strReplace("http://", "https://", origHome);
		final siteUrl = HttpsGlobals.strReplace("http://", "https://", origSiteUrl);

		HttpsGlobals.updateOption("home", home);
		HttpsGlobals.updateOption("siteurl", siteUrl);

		if (!isUsingHttps())
		{
			HttpsGlobals.updateOption("home", origHome);
			HttpsGlobals.updateOption("siteurl", origSiteUrl);
			return false;
		}

		return true;
	}

	public static function updateHttpsMigrationRequired(oldUrl:NativeValue, newUrl:NativeValue):Void
	{
		if (HttpsGlobals.wpInstalling())
		{
			return;
		}

		final oldHttpUrl = HttpsGlobals.untrailingslashit(HttpsGlobals.strval(oldUrl));
		final newHttpUrl = HttpsGlobals.strReplace("https://", "http://", HttpsGlobals.untrailingslashit(HttpsGlobals.strval(newUrl)));
		if (oldHttpUrl != newHttpUrl)
		{
			HttpsGlobals.deleteOption("https_migration_required");
			return;
		}

		HttpsGlobals.updateOption("https_migration_required", !HttpsGlobals.truthy(HttpsGlobals.getOption("fresh_site")));
	}

	public static function isLocalHtmlOutput(html:String):NativeValue
	{
		if (HttpsGlobals.hasAction("wp_head", "rsd_link"))
		{
			final pattern = HttpsGlobals.pregReplace("#^https?:(?=//)#", "", HttpsGlobals.escUrl(HttpsGlobals.siteUrlWithScheme("xmlrpc.php?rsd", "rpc")));
			return html.contains(pattern);
		}

		if (HttpsGlobals.hasAction("wp_head", "rest_output_link_wp_head"))
		{
			final pattern = HttpsGlobals.pregReplace("#^https?:(?=//)#", "", HttpsGlobals.escUrl(HttpsGlobals.getRestUrl()));
			return html.contains(pattern);
		}

		return null;
	}

	static function urlPart(url:String, part:String):String
	{
		return HttpsGlobals.strval(WpNativeArray.get(HttpsGlobals.wpParseUrl(url), part, ""));
	}

	static function remoteRequestArgs(sslVerify:Bool):php.NativeArray
	{
		// WPHX-211: wp_remote_request() consumes WordPress's native associative args/header array.
		return php.Syntax.code("array('headers' => array('Cache-Control' => 'no-cache'), 'sslverify' => {0})", sslVerify);
	}

	static function strictFalse(value:NativeValue):Bool
	{
		// WPHX-211: wp_get_https_detection_errors() distinguishes false from null for local HTML detection.
		return php.Syntax.code("{0} === false", value);
	}

	static function existingWpError(value:NativeValue):WpError
	{
		// WPHX-211: pre_wp_get_https_detection_errors may return a native WP_Error object.
		return cast value;
	}
}

/**
	Narrow externs for WordPress HTTPS helper calls preserved at the PHP boundary.
**/
@:phpGlobal
extern class HttpsGlobals
{
	@:native("home_url")
	public static function homeUrl():String;

	@:native("home_url")
	public static function homeUrlWithScheme(path:String, scheme:String):String;

	@:native("site_url")
	public static function siteUrl():String;

	@:native("site_url")
	public static function siteUrlWithScheme(path:String, scheme:String):String;

	@:native("wp_parse_url")
	public static function wpParseUrl(url:String):php.NativeArray;

	@:native("get_option")
	public static function getOption(name:String):NativeValue;

	@:native("is_wp_error")
	public static function isWpError(value:NativeValue):Bool;

	@:native("wp_remote_request")
	public static function wpRemoteRequest(url:String, args:php.NativeArray):NativeValue;

	@:native("wp_remote_retrieve_response_code")
	public static function wpRemoteRetrieveResponseCode(response:NativeValue):Int;

	@:native("wp_remote_retrieve_response_message")
	public static function wpRemoteRetrieveResponseMessage(response:NativeValue):String;

	@:native("wp_remote_retrieve_body")
	public static function wpRemoteRetrieveBody(response:NativeValue):String;

	@:native("update_option")
	public static function updateOption(name:String, value:NativeValue):Bool;

	@:native("delete_option")
	public static function deleteOption(name:String):Bool;

	@:native("wp_installing")
	public static function wpInstalling():Bool;

	@:native("untrailingslashit")
	public static function untrailingslashit(value:String):String;

	@:native("str_replace")
	public static function strReplace(search:String, replace:String, subject:String):String;

	@:native("strval")
	public static function strval(value:NativeValue):String;

	@:native("__")
	public static function translate(message:String):String;

	@:native("has_action")
	public static function hasAction(hookName:String, callback:String):NativeValue;

	@:native("preg_replace")
	public static function pregReplace(pattern:String, replacement:String, subject:String):String;

	@:native("esc_url")
	public static function escUrl(value:String):String;

	@:native("get_rest_url")
	public static function getRestUrl():String;

	// WPHX-211: PHP truthiness is needed for option and has_action return values.
	@:native("wphx_https_truthy")
	public static function truthy(value:NativeValue):Bool;
}

/**
	Typed subset of WP_Error used by deterministic HTTPS detection probes.
**/
@:native("WP_Error")
extern class WpError
{
	public var errors:php.NativeArray;

	public function new():Void;

	public function add(code:String, message:String):Void;
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class HttpsHooks
{
	@:native("apply_filters")
	public static function applyFiltersSiteUrl(hookName:String, value:NativeValue, path:String, scheme:NativeValue, blogId:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersNative1(hookName:String, value:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersBool(hookName:String, value:Bool):Bool;
}
