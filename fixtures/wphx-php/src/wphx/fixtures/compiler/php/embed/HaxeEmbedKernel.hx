package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Extern for the stock Haxe PHP implementation behind generated embed.php functions.
**/
@:native("\\wphx\\fixtures\\php\\embed\\EmbedKernel")
extern class HaxeEmbedKernel
{
	static function embedRegisterHandler(id:String, regex:String, callback:NativeValue, priority:Int):Void;

	static function embedUnregisterHandler(id:String, priority:Int):Void;

	static function embedDefaults(url:String):NativeValue;

	static function oembedEndpointUrl(permalink:String, format:String):String;

	static function oembedEnsureFormat(format:String):String;

	static function oembedAddProvider(format:String, provider:String, regex:Bool):Void;

	static function oembedRemoveProvider(format:String):Bool;

	static function maybeLoadEmbeds():Void;

	static function embedHandlerYoutube(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;

	static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;

	static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;
}
