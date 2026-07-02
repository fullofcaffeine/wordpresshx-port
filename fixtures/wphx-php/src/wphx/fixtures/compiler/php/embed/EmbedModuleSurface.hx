package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Selected WordPress embed.php module functions emitted at the original path.
**/
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
