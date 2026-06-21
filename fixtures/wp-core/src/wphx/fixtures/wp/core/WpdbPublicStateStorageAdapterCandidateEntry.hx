package wphx.fixtures.wp.core;

import wphx.wp.db.WpdbPublicStateDescriptor;
import wphx.wp.db.WpdbPublicStateStorageAdapter;

@:keep
class WpdbPublicStateStorageAdapterCandidateEntry
{
	static function main():Void
	{
		WpdbPublicStateDescriptor.declaredPublicProperties();
		WpdbPublicStateStorageAdapter.selectedPublicStorageProperties();
		WpdbPublicStateStorageAdapter.selectedMagicStorageProperties();
		WpdbPublicStateStorageAdapter.publicDefaultKind("field_types");
		WpdbPublicStateStorageAdapter.publicStringDefault("last_error");
		WpdbPublicStateStorageAdapter.publicIntDefault("num_rows");
		WpdbPublicStateStorageAdapter.publicBoolDefault("ready");
		WpdbPublicStateStorageAdapter.publicNativeArrayDefaultIsEmpty("field_types");
		WpdbPublicStateStorageAdapter.magicDefaultKind("dbhost");
		WpdbPublicStateStorageAdapter.magicStringDefault("dbhost");
		WpdbPublicStateStorageAdapter.magicBoolDefault("has_connected");
		WpdbPublicStateStorageAdapter.shouldInitializePublicProperty("field_types");
		WpdbPublicStateStorageAdapter.shouldRoutePublicWriteToPhpProperty("last_error");
		WpdbPublicStateStorageAdapter.shouldRouteDynamicWriteToPhpProperty("wphx_plugin_extension");
		WpdbPublicStateStorageAdapter.shouldRouteMagicReadToStorage("dbhost");
		WpdbPublicStateStorageAdapter.shouldRouteMagicWriteToStorage("dbhost");
		WpdbPublicStateStorageAdapter.shouldBlockMagicWrite("col_meta");
		WpdbPublicStateStorageAdapter.writeRoute("dbhost");
		WpdbPublicStateStorageAdapter.fieldTypesDirectMutationAllowed();
		WpdbPublicStateStorageAdapter.dynamicPluginPropertyAllowed();
		WpdbPublicStateStorageAdapter.preservesDbDropinReplacement();
	}
}
