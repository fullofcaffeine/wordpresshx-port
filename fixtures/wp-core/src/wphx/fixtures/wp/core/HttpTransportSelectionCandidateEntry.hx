package wphx.fixtures.wp.core;

import wphx.wp.http.HttpTransportSelection.coreTransportSuffix;
import wphx.wp.http.HttpTransportSelection.defaultTransportTokens;
import wphx.wp.http.HttpTransportSelection.isCoreTransportToken;
import wphx.wp.http.HttpTransportSelection.transportClassName;

/**
	Compile anchor for the deprecated WP_Http transport-selection Haxe candidate.
**/
class HttpTransportSelectionCandidateEntry
{
	static function main():Void
	{
		defaultTransportTokens();
		isCoreTransportToken("curl");
		coreTransportSuffix("streams");
		transportClassName("Curl");
	}
}
