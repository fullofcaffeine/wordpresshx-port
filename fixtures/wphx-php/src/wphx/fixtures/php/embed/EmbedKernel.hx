package wphx.fixtures.php.embed;

import php.SuperGlobal;
import wphx.wp.boundary.NativeArray as WpNativeArray;
import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Selected embed.php helper behavior owned by Haxe behind original-path PHP functions.
**/
@:keep
class EmbedKernel
{
	static var wpOembed:Null<WpOembed> = null;

	public static function embedRegisterHandler(id:String, regex:String, callback:NativeValue, priority:Int):Void
	{
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		wpEmbed.registerHandler(id, regex, callback, priority);
	}

	public static function embedUnregisterHandler(id:String, priority:Int):Void
	{
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		wpEmbed.unregisterHandler(id, priority);
	}

	public static function embedDefaults(url:String):php.NativeArray
	{
		var width = 0;
		final contentWidth = WpNativeArray.get(SuperGlobal.GLOBALS, "content_width", null);
		if (EmbedGlobals.truthy(contentWidth))
		{
			width = EmbedGlobals.intval(contentWidth);
		}

		if (width == 0)
		{
			width = 500;
		}

		final height = Std.int(Math.min(Math.ceil(width * 1.5), 1000));
		return EmbedHooks.applyFiltersNative2("embed_defaults", embedSize(width, height), url);
	}

	public static function oembedGet(url:String, args:NativeValue):NativeValue
	{
		final oembed = oembedGetObject();
		// WPHX-211: wp_oembed_get() forwards WordPress's raw array|string args to WP_oEmbed.
		return oembed.getHtml(url, args);
	}

	public static function oembedGetObject():WpOembed
	{
		if (wpOembed == null)
		{
			// WPHX-211: this preserves WordPress's native WP_oEmbed singleton object boundary.
			wpOembed = new WpOembed();
		}

		return wpOembed;
	}

	public static function oembedEndpointUrl(permalink:String, format:String):String
	{
		var url = EmbedGlobals.restUrl("oembed/1.0/embed");
		if (permalink != "")
		{
			url = EmbedGlobals.addQueryArg(queryArgs(permalink, format), url);
		}

		return EmbedHooks.applyFiltersString3("oembed_endpoint_url", url, permalink, format);
	}

	public static function oembedEnsureFormat(format:String):String
	{
		return format == "xml" || format == "json" ? format : "json";
	}

	public static function oembedAddProvider(format:String, provider:String, regex:Bool):Void
	{
		if (EmbedGlobals.didAction("plugins_loaded") > 0)
		{
			final oembed = oembedGetObject();
			// WPHX-211: WP_oEmbed providers is a public native PHP associative array.
			EmbedGlobals.arraySet(oembed.providers, format, providerPair(provider, regex));
		} else
		{
			WpOembed.addProviderEarly(format, provider, regex);
		}
	}

	public static function oembedRemoveProvider(format:String):Bool
	{
		if (EmbedGlobals.didAction("plugins_loaded") > 0)
		{
			final oembed = oembedGetObject();
			if (WpNativeArray.issetKey(oembed.providers, format))
			{
				// WPHX-211: provider removal mutates WP_oEmbed's native public providers array.
				EmbedGlobals.arrayUnset(oembed.providers, format);
				return true;
			}
		} else
		{
			WpOembed.removeProviderEarly(format);
		}

		return false;
	}

	public static function oembedRegisterRoute():Void
	{
		final controller = new WpOembedController();
		controller.registerRoutes();
	}

	public static function oembedAddHostJs():Void {}

	public static function maybeEnqueueOembedHostJs(html:String):String
	{
		if (EmbedGlobals.truthy(EmbedGlobals.hasAction("wp_head", "wp_oembed_add_host_js"))
			&& EmbedGlobals.pregMatch("/<blockquote\\s[^>]*?wp-embedded-content/", html) > 0)
		{
			EmbedGlobals.wpEnqueueScript("wp-embed");
		}

		return html;
	}

	public static function maybeLoadEmbeds():Void
	{
		if (!EmbedGlobals.truthy(EmbedHooks.applyFiltersNative1("load_default_embeds", true)))
		{
			return;
		}

		embedRegisterHandler("youtube_embed_url", "#https?://(www\\.)?youtube\\.com/(?:v|embed)/([^/]+)#i", "wp_embed_handler_youtube", 10);
		embedRegisterHandler("audio", "#^https?://.+?\\.(" + EmbedGlobals.implode("|", EmbedGlobals.wpGetAudioExtensions()) + ")$#i",
			EmbedHooks.applyFiltersNative1("wp_audio_embed_handler", "wp_embed_handler_audio"), 9999);
		embedRegisterHandler("video", "#^https?://.+?\\.(" + EmbedGlobals.implode("|", EmbedGlobals.wpGetVideoExtensions()) + ")$#i",
			EmbedHooks.applyFiltersNative1("wp_video_embed_handler", "wp_embed_handler_video"), 9999);
	}

	public static function embedHandlerYoutube(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		// WPHX-211: regex matches arrive as a native PHP array at the public handler boundary.
		final matchesArray:php.NativeArray = cast matches;
		final videoId = EmbedGlobals.urlencode(EmbedGlobals.strval(WpNativeArray.get(matchesArray, 2, "")));
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		final embed = wpEmbed.autoembed(EmbedGlobals.sprintfOne("https://youtube.com/watch?v=%s", videoId));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_youtube", embed, attr, url, rawAttr));
	}

	public static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		final audio = EmbedGlobals.sprintfOne("[audio src=\"%s\" /]", EmbedGlobals.escUrl(url));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_audio", audio, attr, url, rawAttr));
	}

	public static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		var dimensions = "";
		// WPHX-211: raw shortcode attributes arrive as a native PHP array at the public handler boundary.
		final rawAttrArray:php.NativeArray = cast rawAttr;
		final width = WpNativeArray.get(rawAttrArray, "width", null);
		final height = WpNativeArray.get(rawAttrArray, "height", null);
		if (EmbedGlobals.truthy(width) && EmbedGlobals.truthy(height))
		{
			dimensions += EmbedGlobals.sprintfInt("width=\"%d\" ", EmbedGlobals.intval(width));
			dimensions += EmbedGlobals.sprintfInt("height=\"%d\" ", EmbedGlobals.intval(height));
		}

		final video = EmbedGlobals.sprintfTwo("[video %s src=\"%s\" /]", dimensions, EmbedGlobals.escUrl(url));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_video", video, attr, url, rawAttr));
	}

	static function embedSize(width:Int, height:Int):php.NativeArray
	{
		// WPHX-211: wp_embed_defaults() returns a native PHP compact('width', 'height') array.
		return php.Syntax.code("array('width' => {0}, 'height' => {1})", width, height);
	}

	static function queryArgs(permalink:String, format:String):php.NativeArray
	{
		// WPHX-211: add_query_arg() consumes a native PHP array with false-valued entries preserved/skipped by PHP.
		return php.Syntax.code("array('url' => urlencode({0}), 'format' => ('json' !== {1}) ? {1} : false)", permalink, format);
	}

	static function providerPair(provider:String, regex:Bool):php.NativeArray
	{
		// WPHX-211: WordPress stores oEmbed provider tuples as native indexed arrays.
		return php.Syntax.code("array({0}, {1})", provider, regex);
	}
}

/**
	Narrow externs for WordPress embed helper calls preserved at the PHP boundary.
**/
@:phpGlobal
extern class EmbedGlobals
{
	@:native("rest_url")
	public static function restUrl(path:String):String;

	@:native("add_query_arg")
	public static function addQueryArg(args:php.NativeArray, url:String):String;

	@:native("esc_url")
	public static function escUrl(url:String):String;

	@:native("urlencode")
	public static function urlencode(value:String):String;

	@:native("sprintf")
	public static function sprintfOne(format:String, arg:String):String;

	@:native("sprintf")
	public static function sprintfTwo(format:String, arg1:String, arg2:String):String;

	@:native("sprintf")
	public static function sprintfInt(format:String, arg:Int):String;

	@:native("strval")
	public static function strval(value:NativeValue):String;

	@:native("intval")
	public static function intval(value:NativeValue):Int;

	@:native("implode")
	public static function implode(separator:String, pieces:php.NativeArray):String;

	@:native("wp_get_audio_extensions")
	public static function wpGetAudioExtensions():php.NativeArray;

	@:native("wp_get_video_extensions")
	public static function wpGetVideoExtensions():php.NativeArray;

	@:native("did_action")
	public static function didAction(hookName:String):Int;

	@:native("has_action")
	public static function hasAction(hookName:String, callback:String):NativeValue;

	@:native("preg_match")
	public static function pregMatch(pattern:String, subject:String):Int;

	@:native("wp_enqueue_script")
	public static function wpEnqueueScript(handle:String):Void;

	@:native("wphx_embed_array_set")
	public static function arraySet(array:php.NativeArray, key:String, value:NativeValue):Void;

	@:native("wphx_embed_array_unset")
	public static function arrayUnset(array:php.NativeArray, key:String):Void;

	// WPHX-211: PHP truthiness is needed for globals and raw handler attributes.
	@:native("wphx_embed_truthy")
	public static function truthy(value:NativeValue):Bool;
}

/**
	Typed subset of WP_oEmbed state used by selected provider registry helpers.
**/
@:native("WP_oEmbed")
extern class WpOembed
{
	public var providers:php.NativeArray;

	public function new():Void;

	@:native("get_html")
	public function getHtml(url:String, args:NativeValue):NativeValue;

	@:native("_add_provider_early")
	public static function addProviderEarly(format:String, provider:String, regex:Bool):Void;

	@:native("_remove_provider_early")
	public static function removeProviderEarly(format:String):Void;
}

/**
	Typed subset of the oEmbed REST controller used by route registration.
**/
@:native("WP_oEmbed_Controller")
extern class WpOembedController
{
	public function new():Void;

	@:native("register_routes")
	public function registerRoutes():Void;
}

/**
	Typed subset of WP_Embed handler registry methods used by selected module functions.
**/
extern class WpEmbed
{
	@:native("register_handler")
	public function registerHandler(id:String, regex:String, callback:NativeValue, priority:Int):Void;

	@:native("unregister_handler")
	public function unregisterHandler(id:String, priority:Int):Void;

	@:native("autoembed")
	public function autoembed(url:String):String;
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class EmbedHooks
{
	@:native("apply_filters")
	public static function applyFiltersNative1(hookName:String, value:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersNative2(hookName:String, value:NativeValue, arg:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersString3(hookName:String, value:String, arg1:String, arg2:String):String;

	@:native("apply_filters")
	public static function applyFiltersNative4(hookName:String, value:NativeValue, arg1:NativeValue, arg2:NativeValue, arg3:NativeValue):NativeValue;
}
