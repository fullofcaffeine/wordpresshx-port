package wphx.fixtures.wp.core;

import wphx.wp.rest.RestSettingsSchemaStrategy;
import wphx.wp.rest.RestSettingsUpdateStrategy;
import wphx.wp.rest.RestSettingsValueStrategy;

@:keep
class RestSettingsUpdateStrategyCandidateEntry
{
	static function main():Void
	{
		RestSettingsSchemaStrategy.ownedControllerBodies();
		RestSettingsValueStrategy.ownedControllerBodies();
		RestSettingsUpdateStrategy.ownedControllerBodies();
		RestSettingsUpdateStrategy.controllerBodyRoute("update_item");
		RestSettingsUpdateStrategy.ownsControllerBody("update_item");
		RestSettingsUpdateStrategy.shouldSkipMissingRequestParam(false);
		RestSettingsUpdateStrategy.shouldSkipAfterPreUpdate(true);
		RestSettingsUpdateStrategy.shouldDeleteOptionForNullValue(true);
		RestSettingsUpdateStrategy.shouldRejectNullForInvalidStoredValue(true, true);
		RestSettingsUpdateStrategy.shouldUpdateOptionForValue(false);
		RestSettingsUpdateStrategy.shouldRefreshResponse();
	}
}
