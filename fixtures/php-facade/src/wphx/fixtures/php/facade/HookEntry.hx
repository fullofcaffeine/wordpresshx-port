package wphx.fixtures.php.facade;

class HookEntry
{
	static function main():Void
	{
		HookKernel.marker("entry");
	}
}
