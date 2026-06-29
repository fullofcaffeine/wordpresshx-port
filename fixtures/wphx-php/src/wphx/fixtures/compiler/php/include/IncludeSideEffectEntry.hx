package wphx.fixtures.compiler.php.include;

/**
	Entry point that keeps the include side-effect script adapter reachable.
**/
class IncludeSideEffectEntry
{
	static function main():Void
	{
		Type.getClassName(IncludeSideEffectScript);
	}
}
