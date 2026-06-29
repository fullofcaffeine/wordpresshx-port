package wphx.fixtures.compiler.php;

import wphx.fixtures.compiler.php.SmokeSurface.add;
import wphx.fixtures.compiler.php.SmokeSurface.greeting;

/**
	Compile anchor for the first WordPressHX PHP custom-emitter smoke fixture.
**/
class SmokeEntry
{
	static function main():Void
	{
		SmokeSurface.label();
		add(1, 2);
		greeting("anchor");
	}
}
