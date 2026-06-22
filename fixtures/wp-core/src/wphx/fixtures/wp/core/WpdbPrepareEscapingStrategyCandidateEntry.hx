package wphx.fixtures.wp.core;

import wphx.wp.db.WpdbPrepareEscapingStrategy;

@:keep
class WpdbPrepareEscapingStrategyCandidateEntry
{
	static function main():Void
	{
		WpdbPrepareEscapingStrategy.ownedPrepareEscapingBodies();
		WpdbPrepareEscapingStrategy.prepareEscapingBodyRoute("prepare");
		WpdbPrepareEscapingStrategy.ownsPrepareEscapingBody("esc_like");
		WpdbPrepareEscapingStrategy.shouldReturnNullPreparedQuery(true);
		WpdbPrepareEscapingStrategy.shouldWarnPrepareMissingPlaceholder(false);
		WpdbPrepareEscapingStrategy.shouldUnpackSingleArrayArgument(1, true);
		WpdbPrepareEscapingStrategy.placeholderFormat("%1$s");
		WpdbPrepareEscapingStrategy.placeholderType("%1$s");
		WpdbPrepareEscapingStrategy.shouldUseLegacyUnsafeFloat("f", true, true);
		WpdbPrepareEscapingStrategy.legacyUnsafeFloatPlaceholder("", "f", 3);
		WpdbPrepareEscapingStrategy.shouldForceLocaleUnawareFloat("f");
		WpdbPrepareEscapingStrategy.localeUnawareFloatPlaceholder(".2");
		WpdbPrepareEscapingStrategy.isIdentifierPlaceholderType("i");
		WpdbPrepareEscapingStrategy.identifierPlaceholder("1$");
		WpdbPrepareEscapingStrategy.shouldTreatPlaceholderAsString("s");
		WpdbPrepareEscapingStrategy.shouldQuoteStringPlaceholder("", false, false);
		WpdbPrepareEscapingStrategy.quotedStringPlaceholder("");
		WpdbPrepareEscapingStrategy.argIndexForPlaceholder("2$", 0);
		WpdbPrepareEscapingStrategy.hasDualUseArguments(1);
		WpdbPrepareEscapingStrategy.argumentCountRoute(1, 2, false);
		WpdbPrepareEscapingStrategy.shouldReturnEmptyForTooFewArgs(1, 2, 0);
		WpdbPrepareEscapingStrategy.shouldUseIdentifierEscaping(0, [0]);
		WpdbPrepareEscapingStrategy.shouldPassNumericArgument(true, false);
		WpdbPrepareEscapingStrategy.shouldRejectUnsupportedPrepareValue(false, false);
		WpdbPrepareEscapingStrategy.shouldRealEscapeReturnEmpty(false);
		WpdbPrepareEscapingStrategy.shouldUseMysqliRealEscape(true);
		WpdbPrepareEscapingStrategy.shouldEmitNoConnectionEscapeWarning(false);
		WpdbPrepareEscapingStrategy.shouldEscapeByReference(false);
		WpdbPrepareEscapingStrategy.shouldRecurseEscapeArrayValue(true);
		WpdbPrepareEscapingStrategy.shouldRegisterPlaceholderFilter(false);
		WpdbPrepareEscapingStrategy.placeholderFilterPriority();
		WpdbPrepareEscapingStrategy.addPlaceholderEscape("a%b", "{placeholder}");
		WpdbPrepareEscapingStrategy.removePlaceholderEscape("a{placeholder}b", "{placeholder}");
		WpdbPrepareEscapingStrategy.escapeIdentifierValue("wp`posts");
		WpdbPrepareEscapingStrategy.quoteIdentifier("wp`posts");
		WpdbPrepareEscapingStrategy.escapeLikeText("a_b%c\\d");
		WpdbPrepareEscapingStrategy.preservesMethodBodyStrategy();
		WpdbPrepareEscapingStrategy.preservesQueryExecutionStrategy();
	}
}
