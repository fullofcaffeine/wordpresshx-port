package wphx.fixtures.wp.core;

import wphx.wp.db.WpdbDbConnectStrategy;

@:keep
class WpdbDbConnectStrategyCandidateEntry
{
	static function main():Void
	{
		WpdbDbConnectStrategy.ownedConnectionBodies();
		WpdbDbConnectStrategy.connectionBodyRoute("db_connect");
		WpdbDbConnectStrategy.ownsConnectionBody("native_real_connect");
		WpdbDbConnectStrategy.shouldMarkIsMysql();
		WpdbDbConnectStrategy.clientFlags(false, 128);
		WpdbDbConnectStrategy.shouldDisableMysqliReport();
		WpdbDbConnectStrategy.shouldUseParsedDbHostData(true);
		WpdbDbConnectStrategy.shouldBracketIpv6Host(true, true);
		WpdbDbConnectStrategy.bracketIpv6Host("::1");
		WpdbDbConnectStrategy.shouldUseDebugRealConnect(false);
		WpdbDbConnectStrategy.shouldClearDbhOnConnectError(1045);
		WpdbDbConnectStrategy.shouldBailOnConnectionFailure(false, true);
		WpdbDbConnectStrategy.shouldReturnFalseOnConnectionFailure(false);
		WpdbDbConnectStrategy.shouldRunConnectionSuccess(true);
		WpdbDbConnectStrategy.shouldInitializeCharsetOnDbConnect(false);
		WpdbDbConnectStrategy.shouldSetHasConnected(true);
		WpdbDbConnectStrategy.shouldMarkReady(true);
		WpdbDbConnectStrategy.shouldSetSqlModeAfterReady(true);
		WpdbDbConnectStrategy.shouldSelectDatabaseAfterReady(true);
		WpdbDbConnectStrategy.preservesQueryExecutionStrategy();
		WpdbDbConnectStrategy.preservesMethodBodyStrategy();
		WpdbDbConnectStrategy.preservesClassShellStrategy();
	}
}
