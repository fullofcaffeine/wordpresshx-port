package wphx.fixtures.compiler.php.template;

/**
	Entry point that keeps the WPHX-320.02 theme HXX markup script reachable.
**/
@:keep
class ThemeHxxMarkupPilotEntry
{
	static function main():Void
	{
		Type.getClassName(ThemeHxxMarkupPilotScript);
	}
}
