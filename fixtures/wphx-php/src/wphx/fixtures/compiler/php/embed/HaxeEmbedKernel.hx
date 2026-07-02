package wphx.fixtures.compiler.php.embed;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Extern for the stock Haxe PHP implementation behind generated embed.php functions.
**/
@:native("\\wphx\\fixtures\\php\\embed\\EmbedKernel")
extern class HaxeEmbedKernel
{
	static function embedDefaults(url:String):NativeValue;

	static function oembedEndpointUrl(permalink:String, format:String):String;

	static function oembedEnsureFormat(format:String):String;

	static function oembedAddProvider(format:String, provider:String, regex:Bool):Void;

	static function oembedRemoveProvider(format:String):Bool;

	static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;

	static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;
}
