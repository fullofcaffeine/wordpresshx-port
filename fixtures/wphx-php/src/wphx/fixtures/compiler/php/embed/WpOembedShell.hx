package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned public `WP_oEmbed` early-provider queue shell.

	This fixture preserves the original-path class ABI for the public/static
	provider queues used before the oEmbed singleton is constructed. Built-in
	provider construction, discovery, remote fetch, parsing, and data rendering
	remain outside this bounded shell.
**/
@:wp.file("wp-includes/class-wp-oembed.php")
@:wp.haxeBootstrap("WPHX_WP_OEMBED_BOOTSTRAPPED")
@:wp.allowDynamicProperties
@:native("WP_oEmbed")
@:keep
class WpOembedShell
{
	@:wp.defaultArray
	public var providers:NativeValue;

	@:wp.defaultArray
	public static var early_providers:NativeValue;

	@:wp.adapter("wp-oembed-add-provider-early")
	public static function _add_provider_early(format:String, provider:String, regex:Bool = false):Void
	{
		format;
		provider;
		regex;
	}

	@:wp.adapter("wp-oembed-remove-provider-early")
	public static function _remove_provider_early(format:String):Void
	{
		format;
	}
}
