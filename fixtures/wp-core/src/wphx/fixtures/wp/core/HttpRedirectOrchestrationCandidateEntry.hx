package wphx.fixtures.wp.core;

import wphx.wp.http.HttpRedirectOrchestration.isTooManyRedirects;
import wphx.wp.http.HttpRedirectOrchestration.shouldShortCircuit;
import wphx.wp.http.HttpRedirectOrchestration.shouldSwitchPostRedirectToGet;

/**
	Compile anchor for the WP_Http redirect orchestration Haxe parity candidate.
**/
class HttpRedirectOrchestrationCandidateEntry
{
	static function main():Void
	{
		shouldShortCircuit(false, 5, 302);
		isTooManyRedirects(0);
		shouldSwitchPostRedirectToGet("POST", 302);
	}
}
