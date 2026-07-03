package wphx.fixtures.compiler.php.template;

/**
	Entry point that keeps the WPHX-315.08 admin HXX markup script reachable.
**/
@:keep
class AdminHxxMarkupPilotEntry
{
	static function main():Void
	{
		Type.getClassName(AdminHxxMarkupPilotScript);
	}
}
