package wphx.fixtures.wp.core;

@:keep
interface PublicClassLoweringContract
{
	public function describe():String;
}

@:keep
class PublicClassLoweringBase
{
	public var baseValue:String;

	public function new(baseValue:String = "base-default")
	{
		this.baseValue = baseValue;
	}

	public function baseLabel():String
	{
		return "base:" + baseValue;
	}
}

@:keep
class PublicClassLoweringSubject extends PublicClassLoweringBase implements PublicClassLoweringContract
{
	public static var instances:Int = 0;

	public var name:String;

	var metaCount:Int;

	public function new(name:String, metaCount:Int = 0)
	{
		super("base-" + name);
		this.name = name;
		this.metaCount = metaCount;
		instances++;
	}

	public static function factory(name:String):PublicClassLoweringSubject
	{
		return new PublicClassLoweringSubject(name, 1);
	}

	public function describe():String
	{
		return name + ":" + metaCount;
	}
}

@:keep
class PublicClassLoweringProofEntry
{
	public static function make():PublicClassLoweringSubject
	{
		return PublicClassLoweringSubject.factory("core");
	}

	static function main():Void {}
}
