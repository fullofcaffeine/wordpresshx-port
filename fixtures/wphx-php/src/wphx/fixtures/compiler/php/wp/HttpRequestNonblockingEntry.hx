package wphx.fixtures.compiler.php.wp;

class HttpRequestNonblockingEntry
{
	static function main():Void
	{
		final http = new WpHttpRequestNonblockingShell();
		http.request("https://example.test/nonblocking", null);
	}
}
