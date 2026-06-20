package wphx.fixtures.php.facade;

import haxe.Json;

typedef FilterRegistration =
{
	final hookName:String;
	final priority:Int;
	final acceptedArgs:Int;
	final callbackKind:String;
};

@:keep
class FacadeKernel
{
	static final registrations:Array<FilterRegistration> = [];

	public static function addFilter(hookName:String, callback:Dynamic, priority:Int = 10, acceptedArgs:Int = 1):Bool
	{
		registrations.push({
			hookName: hookName,
			priority: priority,
			acceptedArgs: acceptedArgs,
			callbackKind: callback == null ? "null" : "callable"
		});

		return true;
	}

	public static function snapshot():String
	{
		return Json.stringify(registrations);
	}
}
