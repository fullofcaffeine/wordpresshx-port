package wphx.wp.db;

using StringTools;

@:keep
class WpdbPrepareEscapingStrategy
{
	public static inline final METHOD_PREPARE = "prepare";
	public static inline final METHOD_REAL_ESCAPE = "_real_escape";
	public static inline final METHOD_ESCAPE = "_escape";
	public static inline final METHOD_LEGACY_ESCAPE = "escape";
	public static inline final METHOD_ESCAPE_BY_REF = "escape_by_ref";
	public static inline final METHOD_WEAK_ESCAPE = "_weak_escape";
	public static inline final METHOD_QUOTE_IDENTIFIER = "quote_identifier";
	public static inline final METHOD_ESCAPE_IDENTIFIER_VALUE = "_escape_identifier_value";
	public static inline final METHOD_ESC_LIKE = "esc_like";
	public static inline final METHOD_PLACEHOLDER_ESCAPE = "placeholder_escape";
	public static inline final METHOD_ADD_PLACEHOLDER_ESCAPE = "add_placeholder_escape";
	public static inline final METHOD_REMOVE_PLACEHOLDER_ESCAPE = "remove_placeholder_escape";
	public static inline final METHOD_BODY_ROUTE_TYPED_HAXE_DECISION = "typed_haxe_prepare_escaping_decision_php_abi_body";
	public static inline final ROUTE_UNKNOWN = "unknown";

	public static inline final ARG_COUNT_OK = "ok";
	public static inline final ARG_COUNT_ARRAY_MULTIPLE_FOR_SINGLE_PLACEHOLDER = "array_multiple_for_single_placeholder";
	public static inline final ARG_COUNT_MISMATCH = "mismatch";

	public static function ownedPrepareEscapingBodies():Array<String>
	{
		return [
			METHOD_PREPARE,
			METHOD_REAL_ESCAPE,
			METHOD_ESCAPE,
			METHOD_LEGACY_ESCAPE,
			METHOD_ESCAPE_BY_REF,
			METHOD_WEAK_ESCAPE,
			METHOD_QUOTE_IDENTIFIER,
			METHOD_ESCAPE_IDENTIFIER_VALUE,
			METHOD_ESC_LIKE,
			METHOD_PLACEHOLDER_ESCAPE,
			METHOD_ADD_PLACEHOLDER_ESCAPE,
			METHOD_REMOVE_PLACEHOLDER_ESCAPE
		];
	}

	public static function prepareEscapingBodyRoute(methodName:String):String
	{
		if (contains(ownedPrepareEscapingBodies(), methodName))
		{
			return METHOD_BODY_ROUTE_TYPED_HAXE_DECISION;
		}
		return ROUTE_UNKNOWN;
	}

	public static function ownsPrepareEscapingBody(methodName:String):Bool
	{
		return prepareEscapingBodyRoute(methodName) == METHOD_BODY_ROUTE_TYPED_HAXE_DECISION;
	}

	public static function shouldReturnNullPreparedQuery(queryIsNull:Bool):Bool
	{
		return queryIsNull;
	}

	public static function shouldWarnPrepareMissingPlaceholder(queryContainsPercent:Bool):Bool
	{
		return !queryContainsPercent;
	}

	public static function shouldUnpackSingleArrayArgument(argsCount:Int, firstArgumentIsArray:Bool):Bool
	{
		return argsCount == 1 && firstArgumentIsArray;
	}

	public static function placeholderFormat(placeholder:String):String
	{
		return placeholder.substring(1, placeholder.length - 1);
	}

	public static function placeholderType(placeholder:String):String
	{
		return placeholder.substr(placeholder.length - 1, 1);
	}

	public static function shouldUseLegacyUnsafeFloat(type:String, allowUnsafeUnquotedParameters:Bool, previousTextEndsWithPercent:Bool):Bool
	{
		return type == "f" && allowUnsafeUnquotedParameters && previousTextEndsWithPercent;
	}

	public static function legacyUnsafeFloatPlaceholder(format:String, type:String, trailingPercentRun:Int):String
	{
		return "%" + (trailingPercentRun % 2 == 1 ? "%" : "") + format + type;
	}

	public static function shouldForceLocaleUnawareFloat(type:String):Bool
	{
		return type == "f";
	}

	public static function localeUnawareFloatPlaceholder(format:String):String
	{
		return "%" + format + "F";
	}

	public static function isIdentifierPlaceholderType(type:String):Bool
	{
		return type == "i";
	}

	public static function identifierPlaceholder(format:String):String
	{
		return "`%" + format + "s`";
	}

	public static function shouldTreatPlaceholderAsString(type:String):Bool
	{
		return type != "d" && type != "F";
	}

	public static function shouldQuoteStringPlaceholder(format:String, allowUnsafeUnquotedParameters:Bool, previousTextEndsWithPercent:Bool):Bool
	{
		return !allowUnsafeUnquotedParameters || (format == "" && !previousTextEndsWithPercent);
	}

	public static function quotedStringPlaceholder(format:String):String
	{
		return "'%" + format + "s'";
	}

	public static function argIndexForPlaceholder(format:String, argId:Int):Int
	{
		final argnumPos = format.indexOf("$");
		if (argnumPos == -1)
		{
			return argId;
		}
		return Std.parseInt(format.substring(0, argnumPos)) - 1;
	}

	public static function hasDualUseArguments(dualUseCount:Int):Bool
	{
		return dualUseCount > 0;
	}

	public static function argumentCountRoute(argsCount:Int, placeholderCount:Int, passedAsArray:Bool):String
	{
		if (argsCount == placeholderCount)
		{
			return ARG_COUNT_OK;
		}
		if (placeholderCount == 1 && passedAsArray)
		{
			return ARG_COUNT_ARRAY_MULTIPLE_FOR_SINGLE_PLACEHOLDER;
		}
		return ARG_COUNT_MISMATCH;
	}

	public static function shouldReturnEmptyForTooFewArgs(argsCount:Int, placeholderCount:Int, maxNumberedPlaceholder:Int):Bool
	{
		if (argsCount >= placeholderCount)
		{
			return false;
		}
		return maxNumberedPlaceholder == 0 || argsCount < maxNumberedPlaceholder;
	}

	public static function shouldUseIdentifierEscaping(argIndex:Int, identifierIndexes:Array<Int>):Bool
	{
		return containsInt(identifierIndexes, argIndex);
	}

	public static function shouldPassNumericArgument(valueIsInt:Bool, valueIsFloat:Bool):Bool
	{
		return valueIsInt || valueIsFloat;
	}

	public static function shouldRejectUnsupportedPrepareValue(valueIsScalar:Bool, valueIsNull:Bool):Bool
	{
		return !valueIsScalar && !valueIsNull;
	}

	public static function shouldRealEscapeReturnEmpty(valueIsScalar:Bool):Bool
	{
		return !valueIsScalar;
	}

	public static function shouldUseMysqliRealEscape(dbhPresent:Bool):Bool
	{
		return dbhPresent;
	}

	public static function shouldEmitNoConnectionEscapeWarning(dbhPresent:Bool):Bool
	{
		return !dbhPresent;
	}

	public static function shouldEscapeByReference(valueIsFloat:Bool):Bool
	{
		return !valueIsFloat;
	}

	public static function shouldRecurseEscapeArrayValue(valueIsArray:Bool):Bool
	{
		return valueIsArray;
	}

	public static function shouldRegisterPlaceholderFilter(hasExistingFilter:Bool):Bool
	{
		return !hasExistingFilter;
	}

	public static function placeholderFilterPriority():Int
	{
		return 0;
	}

	public static function addPlaceholderEscape(query:String, placeholder:String):String
	{
		return query.replace("%", placeholder);
	}

	public static function removePlaceholderEscape(query:String, placeholder:String):String
	{
		return query.replace(placeholder, "%");
	}

	public static function escapeIdentifierValue(identifier:String):String
	{
		return identifier.replace("`", "``");
	}

	public static function quoteIdentifier(identifier:String):String
	{
		return "`" + escapeIdentifierValue(identifier) + "`";
	}

	public static function escapeLikeText(text:String):String
	{
		final result = new StringBuf();
		for (index in 0...text.length)
		{
			final char = text.charAt(index);
			if (char == "_" || char == "%" || char == "\\")
			{
				result.add("\\");
			}
			result.add(char);
		}
		return result.toString();
	}

	public static function preservesMethodBodyStrategy():Bool
	{
		return WpdbMethodBodyStrategy.ownsMethodBody("flush") && WpdbMethodBodyStrategy.ownsMethodBody("get_col_info");
	}

	public static function preservesQueryExecutionStrategy():Bool
	{
		return WpdbQueryExecutionStrategy.ownsExecutionBody("query") && WpdbQueryExecutionStrategy.ownsExecutionBody("do_native_query");
	}

	static function contains(values:Array<String>, name:String):Bool
	{
		for (value in values)
		{
			if (value == name)
			{
				return true;
			}
		}
		return false;
	}

	static function containsInt(values:Array<Int>, needle:Int):Bool
	{
		for (value in values)
		{
			if (value == needle)
			{
				return true;
			}
		}
		return false;
	}
}
