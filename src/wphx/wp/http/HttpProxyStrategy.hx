package wphx.wp.http;

using StringTools;

@:keep
class HttpProxyStrategy
{
	public static function shouldSendThroughProxy(requestHost:String, siteHost:String, bypassHosts:String):Bool
	{
		if (requestHost == "localhost" || (siteHost != "" && requestHost == siteHost))
		{
			return false;
		}

		if (bypassHosts == "")
		{
			return true;
		}

		final hosts = parseBypassHosts(bypassHosts);
		if (bypassHosts.indexOf("*") != -1)
		{
			return !matchesWildcardBypass(requestHost, hosts);
		}

		return !containsExact(hosts, requestHost);
	}

	public static function parseBypassHosts(bypassHosts:String):Array<String>
	{
		final result:Array<String> = [];
		for (part in bypassHosts.split(","))
		{
			final trimmed = trimLeadingWhitespace(part);
			if (trimmed != "")
			{
				result.push(trimmed);
			}
		}
		return result;
	}

	static function matchesWildcardBypass(host:String, bypassHosts:Array<String>):Bool
	{
		for (bypassHost in bypassHosts)
		{
			if (wildcardPatternMatches(host, bypassHost))
			{
				return true;
			}
		}
		return false;
	}

	static function wildcardPatternMatches(host:String, pattern:String):Bool
	{
		return new EReg("^" + wildcardToRegex(pattern) + "$", "i").match(host);
	}

	static function wildcardToRegex(pattern:String):String
	{
		final result = new StringBuf();
		for (index in 0...pattern.length)
		{
			final char = pattern.charAt(index);
			if (char == "*")
			{
				result.add(".+");
			} else
			{
				result.add(escapeRegexChar(char));
			}
		}
		return result.toString();
	}

	static function escapeRegexChar(char:String):String
	{
		return switch (char)
		{
			case "\\", "/", ".", "+", "?", "^", "$", "(", ")", "[", "]", "{", "}", "|":
				"\\" + char;
			default:
				char;
		}
	}

	static function containsExact(values:Array<String>, host:String):Bool
	{
		for (value in values)
		{
			if (value == host)
			{
				return true;
			}
		}
		return false;
	}

	static function trimLeadingWhitespace(value:String):String
	{
		var index = 0;
		while (index < value.length)
		{
			final code = value.charCodeAt(index);
			if (code != " ".code && code != "\t".code && code != "\n".code && code != "\r".code)
			{
				break;
			}
			index++;
		}
		return value.substr(index);
	}
}
