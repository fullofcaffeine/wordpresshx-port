package wphx.fixtures.wp.linker;

import wphx.fixtures.php.facade.LoadKernel;
import wphx.fixtures.php.facade.TemplateKernel;

class LinkerEntry
{
	static function main():Void
	{
		LoadKernel.marker("entry");
		TemplateKernel.marker("entry");
	}
}
