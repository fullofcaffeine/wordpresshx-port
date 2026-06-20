package wphx.fixtures.php.facade;

import haxe.Json;

@:keep
class HookKernel
{
	public static function marker(name:String):String
	{
		return "hook:" + name.toUpperCase();
	}

	public static function eventJson(event:String, hookName:String, detail:String):String
	{
		return Json.stringify({
			event: event,
			hookName: hookName,
			detail: detail
		});
	}
}
