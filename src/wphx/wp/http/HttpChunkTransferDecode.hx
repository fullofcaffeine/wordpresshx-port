package wphx.wp.http;

using StringTools;

/**
	WP_Http::chunkTransferDecode parsing behavior for bounded Haxe ownership.
	The public PHP shell still owns the static method ABI and string return.
**/
/**
	Decodes the same single-chunk shapes covered by the WordPress oracle while
	preserving upstream fallback behavior for non-chunk, malformed, and inter-
	chunk-CRLF multi-chunk bodies.
**/
@:keep
function decodeChunkTransfer(body:String):String
{
	if (!hasChunkHeader(body.trim()))
	{
		return body;
	}

	var remaining = body;
	var parsed = "";

	while (true)
	{
		final header = readChunkHeader(remaining);
		if (header == null)
		{
			return body;
		}

		parsed += remaining.substr(header.headerLength, header.chunkLength);
		remaining = remaining.substr(header.headerLength + header.chunkLength);

		if (remaining.trim() == "0")
		{
			return parsed;
		}
	}
}

/**
	Matches WordPress's chunk-header regex closely enough for the observed parser
	fixture: one or more leading hex digits, optional chunk extensions, then CRLF.
**/
function readChunkHeader(body:String):Null<ChunkHeader>
{
	final lineEnd = body.indexOf("\r\n");
	if (lineEnd == -1)
	{
		return null;
	}

	final line = body.substr(0, lineEnd);
	var index = 0;
	while (index < line.length && isHex(line.charAt(index)))
	{
		index++;
	}
	if (index == 0)
	{
		return null;
	}

	return {
		headerLength: lineEnd + 2,
		chunkLength: parseHex(line.substr(0, index))
	};
}

function hasChunkHeader(body:String):Bool
{
	return readChunkHeader(body) != null;
}

function parseHex(value:String):Int
{
	var parsed = 0;
	for (index in 0...value.length)
	{
		parsed = parsed * 16 + hexValue(value.charAt(index));
	}
	return parsed;
}

function isHex(char:String):Bool
{
	return ("0" <= char && char <= "9") || ("a" <= char && char <= "f") || ("A" <= char && char <= "F");
}

function hexValue(char:String):Int
{
	if ("0" <= char && char <= "9")
	{
		return char.charCodeAt(0) - "0".code;
	}
	if ("a" <= char && char <= "f")
	{
		return char.charCodeAt(0) - "a".code + 10;
	}
	return char.charCodeAt(0) - "A".code + 10;
}

typedef ChunkHeader =
{
	final headerLength:Int;
	final chunkLength:Int;
};
