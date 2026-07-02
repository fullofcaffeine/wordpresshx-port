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

	static function oembedGet(url:String, args:NativeValue):NativeValue;

	static function oembedGetObject():NativeValue;

	static function oembedEndpointUrl(permalink:String, format:String):String;

	static function oembedEnsureFormat(format:String):String;

	static function postEmbedUrl(post:NativeValue = null):NativeValue;

	static function oembedCreateXml(data:NativeValue, node:NativeValue = null):NativeValue;

	static function oembedAddProvider(format:String, provider:String, regex:Bool):Void;

	static function oembedRemoveProvider(format:String):Bool;

	static function oembedRegisterRoute():Void;

	static function oembedDiscoveryLinks():String;

	static function oembedAddHostJs():Void;

	static function maybeEnqueueOembedHostJs(html:String):String;

	static function embedExcerptMore(moreString:String):String;

	static function excerptEmbed():String;

	static function embedExcerptAttachment(content:String):String;

	static function enqueueEmbedScripts():Void;

	static function enqueueEmbedStyles():Void;

	static function embedSiteTitle():String;

	static function filterPreOembedResult(result:NativeValue, url:String, args:NativeValue):NativeValue;

	static function oembedFilterFeedContent(content:String):String;

	static function printEmbedSharingButton():String;

	static function printEmbedCommentsButton():String;

	static function maybeLoadEmbeds():Void;

	static function embedHandlerYoutube(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;

	static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;

	static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String;
}
