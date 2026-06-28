package wphx.fixtures.wp.core;

import wphx.wp.http.HttpChunkTransferDecode.decodeChunkTransfer;

/**
	Compile anchor for the WP_Http::chunkTransferDecode Haxe parity candidate.
**/
class HttpChunkTransferDecodeCandidateEntry
{
	static function main():Void
	{
		decodeChunkTransfer("4\r\nTest\r\n0");
	}
}
