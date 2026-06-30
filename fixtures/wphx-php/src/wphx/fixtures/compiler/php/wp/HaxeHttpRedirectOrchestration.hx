package wphx.fixtures.compiler.php.wp;

@:native("\\wphx\\wp\\http\\_HttpRedirectOrchestration\\HttpRedirectOrchestration_Fields_")
extern class HaxeHttpRedirectOrchestration
{
	static function shouldShortCircuit(hasLocation:Bool, requestedRedirections:Int, responseCode:Int):Bool;

	static function isTooManyRedirects(remainingRedirections:Int):Bool;

	static function shouldSwitchPostRedirectToGet(method:String, responseCode:Int):Bool;
}
