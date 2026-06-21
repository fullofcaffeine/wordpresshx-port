package wphx.fixtures.wp.core;

import wphx.wp.db.WpdbClassShellStrategy;
import wphx.wp.db.WpdbMethodBodyStrategy;

@:keep
class WpdbMethodBodyStrategyCandidateEntry
{
	static function main():Void
	{
		WpdbClassShellStrategy.classShellKind();
		WpdbMethodBodyStrategy.ownedMethodBodies();
		WpdbMethodBodyStrategy.methodBodyRoute("flush");
		WpdbMethodBodyStrategy.methodBodyRoute("get_col_info");
		WpdbMethodBodyStrategy.ownsMethodBody("flush");
		WpdbMethodBodyStrategy.flushResetPublicProperties();
		WpdbMethodBodyStrategy.flushResetLazyParentLoadedProperties();
		WpdbMethodBodyStrategy.flushResetNativeResourceProperties();
		WpdbMethodBodyStrategy.shouldFreeMysqliResult(true);
		WpdbMethodBodyStrategy.shouldDrainMysqliConnection(true, true);
		WpdbMethodBodyStrategy.defaultColumnInfoType();
		WpdbMethodBodyStrategy.shouldReturnAllColumnInfo(-1);
		WpdbMethodBodyStrategy.shouldReturnSingleColumnInfo(0);
		WpdbMethodBodyStrategy.usesParentColInfoLoader();
		WpdbMethodBodyStrategy.usesParentVisibleResultSlot();
		WpdbMethodBodyStrategy.preservesPluginAbiCompatibility();
		WpdbMethodBodyStrategy.preservesRequireWpDbDropinReplacement();
	}
}
