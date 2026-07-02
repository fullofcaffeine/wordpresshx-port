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
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class HttpsHooks
{
	@:native("apply_filters")
	public static function applyFiltersSiteUrl(hookName:String, value:NativeValue, path:String, scheme:NativeValue, blogId:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersBool(hookName:String, value:Bool):Bool;
}
