package wphx.fixtures.wp.core;

import wphx.wp.posts.PostRevisionAdapterContract;

@:keep
class PostRevisionAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("name:revision", PostRevisionAdapterContract.revisionPostName(10, false));
		emit("name:autosave", PostRevisionAdapterContract.revisionPostName(10, true));
		emit("name-kind:revision", PostRevisionAdapterContract.revisionNameKind(10, "10-revision-v1"));
		emit("name-kind:autosave", PostRevisionAdapterContract.revisionNameKind(10, "10-autosave-v1"));
		emit("is-revision:parent", PostRevisionAdapterContract.isRevisionRoute(true, 10));
		emit("is-revision:missing", PostRevisionAdapterContract.isRevisionRoute(false, 0));
		emit("is-autosave:parent", PostRevisionAdapterContract.isAutosaveRoute(true, 10, "10-autosave-v1"));
		emit("is-autosave:not-autosave", PostRevisionAdapterContract.isAutosaveRoute(true, 10, "10-revision-v1"));
		emit("is-autosave:missing", PostRevisionAdapterContract.isAutosaveRoute(false, 0, ""));
		emit("save:doing-autosave", PostRevisionAdapterContract.saveRoute(true, false, true, true, "publish", true, false, true, true));
		emit("save:after-insert-owner", PostRevisionAdapterContract.saveRoute(false, true, true, true, "publish", true, false, true, true));
		emit("save:missing-post", PostRevisionAdapterContract.saveRoute(false, false, false, true, "publish", true, false, true, true));
		emit("save:unsupported", PostRevisionAdapterContract.saveRoute(false, false, true, false, "publish", true, false, true, true));
		emit("save:auto-draft", PostRevisionAdapterContract.saveRoute(false, false, true, true, "auto-draft", true, false, true, true));
		emit("save:disabled", PostRevisionAdapterContract.saveRoute(false, false, true, true, "publish", false, false, true, true));
		emit("save:unchanged", PostRevisionAdapterContract.saveRoute(false, false, true, true, "publish", true, true, true, false));
		emit("save:create-no-latest", PostRevisionAdapterContract.saveRoute(false, false, true, true, "publish", true, false, true, false));
		emit("save:create-changed", PostRevisionAdapterContract.saveRoute(false, false, true, true, "publish", true, true, true, true));
		emit("put:invalid", PostRevisionAdapterContract.putRoute(false, 0, "post"));
		emit("put:revision-of-revision", PostRevisionAdapterContract.putRoute(true, 11, "revision"));
		emit("put:insert", PostRevisionAdapterContract.putRoute(true, 10, "post"));
		emit("restore:missing", PostRevisionAdapterContract.restoreRoute(false, 3, true));
		emit("restore:no-fields", PostRevisionAdapterContract.restoreRoute(true, 0, true));
		emit("restore:update-failed", PostRevisionAdapterContract.restoreRoute(true, 3, false));
		emit("restore:update-post", PostRevisionAdapterContract.restoreRoute(true, 3, true));
		emit("delete:missing", PostRevisionAdapterContract.deleteRoute(false, true));
		emit("delete:failed", PostRevisionAdapterContract.deleteRoute(true, false));
		emit("delete:revision", PostRevisionAdapterContract.deleteRoute(true, true));
		emit("retention:disabled", PostRevisionAdapterContract.retentionPlan(0, 4));
		emit("retention:unlimited", PostRevisionAdapterContract.retentionPlan(-1, 99));
		emit("retention:keep-all", PostRevisionAdapterContract.retentionPlan(5, 4));
		emit("retention:prune", PostRevisionAdapterContract.retentionPlan(2, 4));
		emitInt("keep:true", PostRevisionAdapterContract.revisionsToKeep(7, true, true));
		emitInt("keep:number", PostRevisionAdapterContract.revisionsToKeep(7, false, true));
		emitInt("keep:unsupported", PostRevisionAdapterContract.revisionsToKeep(7, false, false));
		emit("meta:none", PostRevisionAdapterContract.metaPlan("save", 0));
		emit("meta:save", PostRevisionAdapterContract.metaPlan("save", 2));
		emit("meta:restore", PostRevisionAdapterContract.metaPlan("restore", 2));
		emit("meta:compare", PostRevisionAdapterContract.metaPlan("compare", 2));
		emit("hook:put", PostRevisionAdapterContract.hookPlan("put", true));
		emit("hook:restore", PostRevisionAdapterContract.hookPlan("restore", true));
		emit("hook:delete", PostRevisionAdapterContract.hookPlan("delete", true));
		emit("hook:failed", PostRevisionAdapterContract.hookPlan("put", false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}

	static function emitInt(key:String, value:Int):Void
	{
		Sys.println(key + "=" + value);
	}
}
