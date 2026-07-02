package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Selected WordPress embed.php module functions emitted at the original path.
**/
@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_register_handler")
@:keep
function wpEmbedRegisterHandler(@:wp.name("id") id:String, @:wp.name("regex") regex:String, @:wp.name("callback") callback:NativeValue,
	@:wp.name("priority") priority:Int = 10):Void
{
	HaxeEmbedKernel.embedRegisterHandler(id, regex, callback, priority);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_unregister_handler")
@:keep
function wpEmbedUnregisterHandler(@:wp.name("id") id:String, @:wp.name("priority") priority:Int = 10):Void
{
	HaxeEmbedKernel.embedUnregisterHandler(id, priority);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_defaults")
@:keep
function wpEmbedDefaults(@:wp.name("url") url:String = ""):NativeValue
{
	return HaxeEmbedKernel.embedDefaults(url);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_get")
@:keep
function wpOembedGet(@:wp.name("url") url:String, @:wp.name("args") args:NativeValue = ""):NativeValue
{
	return HaxeEmbedKernel.oembedGet(url, args);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("_wp_oembed_get_object")
@:keep
function wpOembedGetObject():NativeValue
{
	return HaxeEmbedKernel.oembedGetObject();
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("get_oembed_endpoint_url")
@:keep
function getOembedEndpointUrl(@:wp.name("permalink") permalink:String = "", @:wp.name("format") format:String = "json"):String
{
	return HaxeEmbedKernel.oembedEndpointUrl(permalink, format);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_ensure_format")
@:keep
function wpOembedEnsureFormat(@:wp.name("format") format:String):String
{
	return HaxeEmbedKernel.oembedEnsureFormat(format);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_add_provider")
@:keep
function wpOembedAddProvider(@:wp.name("format") format:String, @:wp.name("provider") provider:String, @:wp.name("regex") regex:Bool = false):Void
{
	HaxeEmbedKernel.oembedAddProvider(format, provider, regex);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_remove_provider")
@:keep
function wpOembedRemoveProvider(@:wp.name("format") format:String):Bool
{
	return HaxeEmbedKernel.oembedRemoveProvider(format);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_register_route")
@:keep
function wpOembedRegisterRoute():Void
{
	HaxeEmbedKernel.oembedRegisterRoute();
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_oembed_add_host_js")
@:keep
function wpOembedAddHostJs():Void
{
	HaxeEmbedKernel.oembedAddHostJs();
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_maybe_enqueue_oembed_host_js")
@:keep
function wpMaybeEnqueueOembedHostJs(@:wp.name("html") html:String):String
{
	return HaxeEmbedKernel.maybeEnqueueOembedHostJs(html);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_maybe_load_embeds")
@:keep
function wpMaybeLoadEmbeds():Void
{
	HaxeEmbedKernel.maybeLoadEmbeds();
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_handler_youtube")
@:keep
function wpEmbedHandlerYoutube(@:wp.name("matches") matches:NativeValue, @:wp.name("attr") attr:NativeValue, @:wp.name("url") url:String,
	@:wp.name("rawattr") rawAttr:NativeValue):String
{
	return HaxeEmbedKernel.embedHandlerYoutube(matches, attr, url, rawAttr);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_handler_audio")
@:keep
function wpEmbedHandlerAudio(@:wp.name("matches") matches:NativeValue, @:wp.name("attr") attr:NativeValue, @:wp.name("url") url:String,
	@:wp.name("rawattr") rawAttr:NativeValue):String
{
	return HaxeEmbedKernel.embedHandlerAudio(matches, attr, url, rawAttr);
}

@:wp.file("wp-includes/embed.php")
@:wp.haxeBootstrap("WPHX_EMBED_MODULE_BOOTSTRAPPED")
@:wp.global("wp_embed_handler_video")
@:keep
function wpEmbedHandlerVideo(@:wp.name("matches") matches:NativeValue, @:wp.name("attr") attr:NativeValue, @:wp.name("url") url:String,
	@:wp.name("rawattr") rawAttr:NativeValue):String
{
	return HaxeEmbedKernel.embedHandlerVideo(matches, attr, url, rawAttr);
}
