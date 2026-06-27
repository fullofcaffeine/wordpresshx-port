package wphx.fixtures.wp.core;

import wphx.wp.http.HttpEncodingStrategy;

class HttpEncodingCandidateEntry
{
	static function main():Void
	{
		HttpEncodingStrategy.contentEncoding();
		HttpEncodingStrategy.isAvailable();
		HttpEncodingStrategy.compress("fixture", 6);
		HttpEncodingStrategy.decompress("");
	}
}
