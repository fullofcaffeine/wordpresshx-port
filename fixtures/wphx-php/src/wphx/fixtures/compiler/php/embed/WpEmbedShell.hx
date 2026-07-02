package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Compiler-owned public `WP_Embed` handler-registry shell.

	This fixture preserves the original-path class ABI and the native nested
	handlers array mutation used by `register_handler()` and
	`unregister_handler()`. Constructor hooks, shortcode parsing, cache writes,
	autoembed, and remote oEmbed behavior remain outside this bounded shell.
**/
@:wp.file("wp-includes/class-wp-embed.php")
@:wp.haxeBootstrap("WPHX_WP_EMBED_BOOTSTRAPPED")
@:wp.allowDynamicProperties
@:native("WP_Embed")
@:keep
class WpEmbedShell
{
	@:wp.defaultArray
	public var handlers:NativeValue;
	public var post_ID:NativeValue;
	@:wp.defaultTrue
	public var usecache:NativeValue;
	@:wp.defaultTrue
	public var linkifunknown:NativeValue;
	@:wp.defaultArray
	public var last_attr:NativeValue;
	@:wp.defaultString("")
	public var last_url:NativeValue;
	@:wp.defaultFalse
	public var return_false_on_fail:NativeValue;

	@:wp.adapter("wp-embed-register-handler")
	public function register_handler(id:String, regex:String, callback:NativeValue, priority:Int = 10):Void
	{
		id;
		regex;
		callback;
		priority;
	}

	@:wp.adapter("wp-embed-unregister-handler")
	public function unregister_handler(id:String, priority:Int = 10):Void
	{
		id;
		priority;
	}

	@:wp.adapter("wp-embed-get-handler-html")
	public function get_embed_handler_html(attr:NativeValue, url:String):NativeValue
	{
		attr;
		url;
		return false;
	}

	@:wp.adapter("wp-embed-maybe-make-link")
	public function maybe_make_link(url:String):NativeValue
	{
		url;
		return false;
	}
}
