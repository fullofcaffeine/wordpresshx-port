package wphx.fixtures.wp.core;

import wphx.wp.rest.RestSettingsSchemaStrategy;
import wphx.wp.rest.RestSettingsValueStrategy;

@:keep
class RestSettingsValueStrategyCandidateEntry
{
	static function main():Void
	{
		RestSettingsSchemaStrategy.ownedControllerBodies();
		RestSettingsValueStrategy.ownedControllerBodies();
		RestSettingsValueStrategy.controllerBodyRoute("get_item");
		RestSettingsValueStrategy.ownsControllerBody("prepare_value");
		RestSettingsValueStrategy.shouldUseOptionFallback(true);
		RestSettingsValueStrategy.shouldReturnNullForInvalidSchemaValue(true);
		RestSettingsValueStrategy.shouldSanitizeSchemaValue(false);
		RestSettingsValueStrategy.shouldPreserveNullSanitizeInput(true);
	}
}
