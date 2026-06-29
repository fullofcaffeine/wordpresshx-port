package wphx.fixtures.compiler.php.wp;

/**
	Extern for the stock Haxe PHP module-level chunk-transfer implementation.
**/
@:native("\\wphx\\wp\\http\\_HttpChunkTransferDecode\\HttpChunkTransferDecode_Fields_")
extern class HaxeHttpChunkTransferDecode
{
	static function decodeChunkTransfer(body:String):String;
}
