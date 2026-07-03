package wphx.fixtures.compiler.php.core;

/**
	Compile anchor for the generic WPHX PHP static/member lowering fixture.
**/
class StaticDynamicMemberEntry
{
	static function main():Void
	{
		StaticDynamicMemberSurface.bump(5);
		StaticDynamicMemberSurface.describe(9);
		StaticDynamicMemberSurface.makeName("core");
	}
}
