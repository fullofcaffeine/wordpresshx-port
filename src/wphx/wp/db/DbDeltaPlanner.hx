package wphx.wp.db;

using StringTools;

@:keep
class DbDeltaPlanner
{
	public static function queryKind(query:String):String
	{
		if (query.startsWith("CREATE TABLE "))
		{
			return "create_table";
		}
		if (query.startsWith("CREATE DATABASE "))
		{
			return "create_database";
		}
		if (query.startsWith("INSERT INTO "))
		{
			return "insert";
		}
		if (query.startsWith("UPDATE "))
		{
			return "update";
		}
		return "unknown";
	}

	public static function queryObjectName(query:String, kind:String):String
	{
		final prefix = switch kind
		{
			case "create_table": "CREATE TABLE ";
			case "create_database": "CREATE DATABASE ";
			case "insert": "INSERT INTO ";
			case "update": "UPDATE ";
			case _: "";
		}
		if (prefix == "" || !query.startsWith(prefix))
		{
			return "";
		}
		return readUntilSpace(query, prefix.length);
	}

	public static function trimBackticks(name:String):String
	{
		var result = name;
		while (result.startsWith("`"))
		{
			result = result.substr(1);
		}
		while (result.endsWith("`"))
		{
			result = result.substr(0, result.length - 1);
		}
		return result;
	}

	public static function fieldNameFromDefinition(fieldDefinition:String):String
	{
		return trimBackticks(readUntilSpace(fieldDefinition, 0));
	}

	public static function normalizeIdentifier(identifier:String):String
	{
		return identifier.toLowerCase();
	}

	public static function isFieldLine(fieldNameLowercased:String):Bool
	{
		return switch fieldNameLowercased
		{
			case "" | "primary" | "index" | "fulltext" | "unique" | "key" | "spatial":
				false;
			case _:
				true;
		}
	}

	public static function normalizeIndexType(indexType:String):String
	{
		return collapseWhitespace(indexType.trim()).toUpperCase().replace("INDEX", "KEY");
	}

	public static function normalizedIndexName(indexType:String, indexName:String):String
	{
		return indexType == "PRIMARY KEY" ? "" : "`" + indexName.toLowerCase() + "`";
	}

	static function readUntilSpace(value:String, start:Int):String
	{
		var end = start;
		while (end < value.length && value.charCodeAt(end) != " ".code)
		{
			end++;
		}
		return value.substring(start, end);
	}

	static function collapseWhitespace(value:String):String
	{
		final result = new StringBuf();
		var previousWasWhitespace = false;
		for (index in 0...value.length)
		{
			final code = value.charCodeAt(index);
			final whitespace = code == " ".code || code == "\t".code || code == "\n".code || code == "\r".code;
			if (whitespace)
			{
				if (!previousWasWhitespace)
				{
					result.add(" ");
				}
				previousWasWhitespace = true;
			} else
			{
				result.addChar(code);
				previousWasWhitespace = false;
			}
		}
		return result.toString();
	}
}
