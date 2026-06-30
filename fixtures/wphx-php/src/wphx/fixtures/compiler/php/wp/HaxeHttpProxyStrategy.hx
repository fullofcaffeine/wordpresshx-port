package wphx.fixtures.compiler.php.wp;

@:native("\\wphx\\wp\\http\\HttpProxyStrategy")
extern class HaxeHttpProxyStrategy
{
	static function shouldSendThroughProxy(requestHost:String, siteHost:String, bypassHosts:String):Bool;
}
