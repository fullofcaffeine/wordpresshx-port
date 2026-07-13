package wphx.fixtures.genes.react;

/** Keeps the exported F9 component reachable under full Haxe dead-code elimination. */
class Main
{
	static function main():Void
	{
		final component = TableOfContentsList.Component;
		if (component == null)
			throw "Missing TableOfContentsList component";
	}
}
