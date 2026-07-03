package wphx.fixtures.compiler.php.embed;

/**
	Compile anchor for the bounded `WP_oEmbed` early-provider shell.
**/
class WpOembedProvidersEntry
{
	static function main():Void
	{
		WpOembedShell._add_provider_early("https://early.example/*", "https://early.example/oembed", false);
		WpOembedShell._remove_provider_early("https://removed.example/*");
	}
}
