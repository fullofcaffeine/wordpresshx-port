package wphx.wp.http;

import haxe.extern.EitherType;
import php.NativeArray;

using StringTools;

typedef StringOrFalse = EitherType<String, Bool>;

@:keep
class HttpEncodingStrategy
{
	public static function compress(raw:String, level:Int):StringOrFalse
	{
		return PhpZlib.gzdeflate(raw, level);
	}

	public static function decompress(compressed:String):StringOrFalse
	{
		if (compressed == "")
		{
			return compressed;
		}

		final inflated = PhpZlib.gzinflate(compressed);
		if (inflated != false)
		{
			return inflated;
		}

		final compatible = compatibleGzinflate(compressed);
		if (compatible != false)
		{
			return compatible;
		}

		final uncompressed = PhpZlib.gzuncompress(compressed);
		if (uncompressed != false)
		{
			return uncompressed;
		}

		if (PhpZlib.functionExists("gzdecode"))
		{
			final decoded = PhpZlib.gzdecode(compressed);
			if (decoded != false)
			{
				return decoded;
			}
		}

		return compressed;
	}

	public static function compatibleGzinflate(gzData:String):StringOrFalse
	{
		if (PhpString.startsWithGzipHeader(gzData))
		{
			var offset = 10;
			final flags = PhpString.ord(PhpString.substr(gzData, 3, 1));
			if (flags > 0)
			{
				if ((flags & 4) != 0)
				{
					final xlen = PhpString.unpackLittleEndianShort(PhpString.substr(gzData, offset, 2));
					offset = offset + 2 + xlen;
				}
				if ((flags & 8) != 0)
				{
					offset = PhpString.strpos(gzData, "\u0000", offset) + 1;
				}
				if ((flags & 16) != 0)
				{
					offset = PhpString.strpos(gzData, "\u0000", offset) + 1;
				}
				if ((flags & 2) != 0)
				{
					offset += 2;
				}
			}
			final decompressed = PhpZlib.gzinflate(PhpString.substrWithLength(gzData, offset, -8));
			if (decompressed != false)
			{
				return decompressed;
			}
		}

		final zlibHeader = PhpZlib.gzinflate(PhpString.substr(gzData, 2));
		if (zlibHeader != false)
		{
			return zlibHeader;
		}

		return false;
	}

	public static function contentEncoding():String
	{
		return "deflate";
	}

	public static function shouldDecodeFromNativeHeaders(headers:NativeArray):Bool
	{
		return PhpArray.keyExists("content-encoding", headers) && !PhpValue.empty(PhpArray.get("content-encoding", headers));
	}

	public static function shouldDecodeFromString(headers:String):Bool
	{
		return PhpString.stripos(headers, "content-encoding:") != false;
	}

	public static function isAvailable():Bool
	{
		return PhpZlib.functionExists("gzuncompress") || PhpZlib.functionExists("gzdeflate") || PhpZlib.functionExists("gzinflate");
	}
}

@:keep
class PhpZlib
{
	// WPHX-211: zlib functions are PHP-native transfer-encoding primitives.
	public static function gzdeflate(raw:String, level:Int):StringOrFalse
	{
		return php.Syntax.code("@gzdeflate({0}, {1})", raw, level);
	}

	// WPHX-211: zlib functions return false on failure and binary strings on success.
	public static function gzinflate(compressed:String):StringOrFalse
	{
		return php.Syntax.code("@gzinflate({0})", compressed);
	}

	// WPHX-211: WordPress preserves PHP's gzuncompress fallback behavior.
	public static function gzuncompress(compressed:String):StringOrFalse
	{
		return php.Syntax.code("@gzuncompress({0})", compressed);
	}

	// WPHX-211: gzdecode can be disabled independently, so availability is checked first.
	public static function gzdecode(compressed:String):StringOrFalse
	{
		return php.Syntax.code("@gzdecode({0})", compressed);
	}

	// WPHX-211: function_exists reflects the PHP runtime extension surface.
	public static function functionExists(name:String):Bool
	{
		return php.Syntax.code("function_exists({0})", name);
	}
}

@:keep
class PhpString
{
	// WPHX-211: WordPress' gzip compatibility parser uses byte-oriented PHP string offsets.
	public static function startsWithGzipHeader(value:String):Bool
	{
		return php.Syntax.code("str_starts_with({0}, \"\\x1f\\x8b\\x08\")", value);
	}

	// WPHX-211: WordPress' gzip compatibility parser uses byte-oriented PHP string offsets.
	public static function substr(value:String, offset:Int, ?length:Int):String
	{
		return length == null ? php.Syntax.code("substr({0}, {1})", value, offset) : php.Syntax.code("substr({0}, {1}, {2})", value, offset, length);
	}

	// WPHX-211: negative PHP substr lengths preserve the gzip trailer stripping contract.
	public static function substrWithLength(value:String, offset:Int, length:Int):String
	{
		return php.Syntax.code("substr({0}, {1}, {2})", value, offset, length);
	}

	// WPHX-211: ord(substr(...)) mirrors the upstream gzip flag parser.
	public static function ord(value:String):Int
	{
		return php.Syntax.code("ord({0})", value);
	}

	// WPHX-211: unpack('v', ...) is the PHP-native little-endian short parser used upstream.
	public static function unpackLittleEndianShort(value:String):Int
	{
		return php.Syntax.code("array_values(unpack('v', {0}))[0]", value);
	}

	// WPHX-211: PHP strpos returns false, but WordPress uses it only on known-present gzip fields here.
	public static function strpos(haystack:String, needle:String, offset:Int):Int
	{
		return php.Syntax.code("strpos({0}, {1}, {2})", haystack, needle, offset);
	}

	// WPHX-211: stripos preserves PHP's false-or-int return contract for header scanning.
	public static function stripos(haystack:String, needle:String):EitherType<Int, Bool>
	{
		return php.Syntax.code("stripos({0}, {1})", haystack, needle);
	}
}

@:keep
class PhpArray
{
	// WPHX-211: headers arrive as native PHP arrays at the public class boundary.
	public static function keyExists(key:String, array:NativeArray):Bool
	{
		return php.Syntax.code("array_key_exists({0}, {1})", key, array);
	}

	// WPHX-211: native array indexing preserves PHP associative array behavior.
	public static function get(key:String, array:NativeArray):StringOrFalse
	{
		return php.Syntax.code("{1}[{0}]", key, array);
	}
}

@:keep
class PhpValue
{
	// WPHX-211: PHP empty() semantics are required for content-encoding header checks.
	public static function empty(value:StringOrFalse):Bool
	{
		return php.Syntax.code("empty({0})", value);
	}
}
