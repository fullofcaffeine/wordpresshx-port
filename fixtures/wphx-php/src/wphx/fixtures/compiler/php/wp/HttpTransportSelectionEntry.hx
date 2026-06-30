package wphx.fixtures.compiler.php.wp;

class HttpTransportSelectionEntry
{
	static function main():Void
	{
		final http = new WpHttpTransportSelectionShell();
		http._get_first_available_transport(null);
	}
}
