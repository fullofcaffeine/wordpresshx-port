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

	public static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		final audio = EmbedGlobals.sprintfOne("[audio src=\"%s\" /]", EmbedGlobals.escUrl(url));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_audio", audio, attr, url, rawAttr));
	}

	public static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		var dimensions = "";
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

	// WPHX-211: PHP truthiness is needed for globals and raw handler attributes.
	@:native("wphx_embed_truthy")
	public static function truthy(value:NativeValue):Bool;
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class EmbedHooks
{
	@:native("apply_filters")
	public static function applyFiltersNative2(hookName:String, value:NativeValue, arg:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersString3(hookName:String, value:String, arg1:String, arg2:String):String;

	@:native("apply_filters")
	public static function applyFiltersNative4(hookName:String, value:NativeValue, arg1:NativeValue, arg2:NativeValue, arg3:NativeValue):NativeValue;
}
