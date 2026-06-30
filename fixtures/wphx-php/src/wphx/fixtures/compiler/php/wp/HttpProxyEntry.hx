package wphx.fixtures.compiler.php.wp;

class HttpProxyEntry
{
	static function main():Void
	{
		final proxy:WpHttpProxyShell = cast null;
		proxy.is_enabled();
		proxy.use_authentication();
		proxy.host();
		proxy.port();
		proxy.username();
		proxy.password();
		proxy.authentication();
		proxy.authentication_header();
		proxy.send_through_proxy("https://example.test/");
	}
}
