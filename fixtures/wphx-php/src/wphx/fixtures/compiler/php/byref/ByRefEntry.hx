package wphx.fixtures.compiler.php.byref;

import wphx.fixtures.compiler.php.byref.ByRefSurface.append;

/**
	Compile anchor for the WPHX PHP by-reference parameter fixture.
**/
class ByRefEntry
{
	static function main():Void
	{
		var value = "seed";
		append(value);
	}
}
