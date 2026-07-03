package wphx.fixtures.compiler.php.core;

/**
	Structural row value used to keep anonymous object/member lowering observable.
**/
typedef StaticDynamicMemberRow =
{
	final label:String;
	final amount:Int;
}

/**
	Minimized public shell surface for reusable WPHX PHP static/member lowering.
**/
@:wp.file("wp-includes/wphx-static-dynamic-member.php")
@:native("WPHX_Static_Dynamic_Member")
@:wp.ifMissing
@:keep
class StaticDynamicMemberSurface
{
	public static var counter:Int = 3;
	public static var values:Array<Int> = [2, 4, 8];

	public var name:String;
	public var hits:Int = 0;

	public function new(name:String)
	{
		this.name = name;
	}

	public static function bump(delta:Int):Int
	{
		counter += delta;
		values[1] = values[1] + counter;
		return values[1];
	}

	public static function current():Int
	{
		return counter;
	}

	public static function row(value:Int):StaticDynamicMemberRow
	{
		return {
			label: "item",
			amount: value
		};
	}

	public static function describe(value:Int):String
	{
		final row = row(value);
		return row.label + ":" + row.amount;
	}

	public static function makeName(name:String):String
	{
		final item = new StaticDynamicMemberSurface(name);
		return item.rename("made-" + name);
	}

	public function rename(next:String):String
	{
		this.name = next;
		this.hits += 1;
		return this.name + ":" + this.hits;
	}
}
