package wphx.fixtures.compiler.php.embed;

/**
	Compile anchor for the bounded `WP_Embed` handler-registry shell.
**/
class WpEmbedHandlersEntry
{
	static function main():Void
	{
		// WPHX-211: compile anchor for instance methods without claiming WP_Embed constructor behavior.
		final embed:WpEmbedShell = cast null;
		embed.register_handler("fixture", "#fixture#", null, 10);
		embed.unregister_handler("fixture", 10);
		embed.get_embed_handler_html(null, "https://example.test/");
		embed.maybe_make_link("https://example.test/");
		embed.delete_oembed_caches(123);
		embed.autoembed_callback(null);
		embed.autoembed("https://example.test/");
		embed.cache_oembed(123);
	}
}
