package wphx.fixtures.wp.core;

import wphx.wp.db.WpdbQueryExecutionStrategy;

@:keep
class WpdbQueryExecutionStrategyCandidateEntry
{
	static function main():Void
	{
		WpdbQueryExecutionStrategy.ownedExecutionBodies();
		WpdbQueryExecutionStrategy.executionBodyRoute("query");
		WpdbQueryExecutionStrategy.ownsExecutionBody("do_native_query");
		WpdbQueryExecutionStrategy.shouldShortCircuitNotReady(false);
		WpdbQueryExecutionStrategy.shouldRunFilteredQuery("SELECT 1");
		WpdbQueryExecutionStrategy.shouldResetInsertIdForEmptyQuery(false);
		WpdbQueryExecutionStrategy.shouldRunInvalidTextCheck(true, false);
		WpdbQueryExecutionStrategy.shouldRejectStrippedQuery(false);
		WpdbQueryExecutionStrategy.shouldResetCheckCurrentQueryAfterValidation();
		WpdbQueryExecutionStrategy.funcCallValue("SELECT 1");
		WpdbQueryExecutionStrategy.queryKind("INSERT INTO wp_options VALUES (1)");
		WpdbQueryExecutionStrategy.shouldReturnNativeResult("ddl");
		WpdbQueryExecutionStrategy.shouldUseAffectedRows("insert_or_replace");
		WpdbQueryExecutionStrategy.shouldStoreInsertId("insert_or_replace");
		WpdbQueryExecutionStrategy.shouldClearInsertIdAfterError(12, "insert_or_replace");
		WpdbQueryExecutionStrategy.shouldAttemptReconnect(false, 2006);
		WpdbQueryExecutionStrategy.shouldExecuteNativeQuery(true);
		WpdbQueryExecutionStrategy.shouldCaptureQueryLog(false);
		WpdbQueryExecutionStrategy.nextQueryCount(3);
		WpdbQueryExecutionStrategy.shouldPopulateSelectedRows(true);
		WpdbQueryExecutionStrategy.initialSelectedRowCount();
		WpdbQueryExecutionStrategy.nextSelectedRowCount(3);
		WpdbQueryExecutionStrategy.selectedRowsReturnValue(4);
		WpdbQueryExecutionStrategy.shouldInitializeCharsetOnDbConnect(false);
		WpdbQueryExecutionStrategy.shouldMarkDbConnectionReady(true);
		WpdbQueryExecutionStrategy.preservesFlushAndColumnInfoStrategy();
		WpdbQueryExecutionStrategy.preservesClassShellStrategy();
	}
}
