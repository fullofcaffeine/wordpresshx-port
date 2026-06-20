package wphx.wp.formatting;

using StringTools;

@:keep
class PureFormatting
{
	public static function zeroise(number:String, threshold:Int):String
	{
		return number.lpad("0", threshold);
	}

	public static function sanitizeKey(key:String):String
	{
		final lower = key.toLowerCase();
		final result = new StringBuf();
		for (index in 0...lower.length)
		{
			final code = lower.charCodeAt(index);
			if (isLowerAlpha(code) || isDigit(code) || code == "_".code || code == "-".code)
			{
				result.addChar(code);
			}
		}
		return result.toString();
	}

	public static function sanitizeHexColor(color:String):Null<String>
	{
		if (color == "")
		{
			return "";
		}
		if (isHashHexColor(color))
		{
			return color;
		}
		return null;
	}

	public static function sanitizeHexColorNoHash(color:String):Null<String>
	{
		var normalized = color;
		while (normalized.startsWith("#"))
		{
			normalized = normalized.substr(1);
		}
		if (normalized == "")
		{
			return "";
		}
		return sanitizeHexColor("#" + normalized) != null ? normalized : null;
	}

	static function isHashHexColor(color:String):Bool
	{
		if (!color.startsWith("#"))
		{
			return false;
		}
		final digitCount = color.length - 1;
		if (digitCount != 3 && digitCount != 6)
		{
			return false;
		}
		for (index in 1...color.length)
		{
			if (!isHexDigit(color.charCodeAt(index)))
			{
				return false;
			}
		}
		return true;
	}

	static function isHexDigit(code:Int):Bool
	{
		return isDigit(code) || (code >= "a".code && code <= "f".code) || (code >= "A".code && code <= "F".code);
	}

	static function isLowerAlpha(code:Int):Bool
	{
		return code >= "a".code && code <= "z".code;
	}

	static function isDigit(code:Int):Bool
	{
		return code >= "0".code && code <= "9".code;
	}
}
