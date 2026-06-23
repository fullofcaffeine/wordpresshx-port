package wphx.fixtures.wp.core;

import wphx.wp.posts.PostMetaCacheAdapterContract;

@:keep
class PostMetaCacheAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("object:post", PostMetaCacheAdapterContract.objectRoute(false));
		emit("object:revision", PostMetaCacheAdapterContract.objectRoute(true));
		emitInt("object-id:post", PostMetaCacheAdapterContract.routedObjectId(10, 0));
		emitInt("object-id:revision-parent", PostMetaCacheAdapterContract.routedObjectId(11, 10));
		emit("add:invalid", PostMetaCacheAdapterContract.addRoute("post", 0, "k", true, false, false));
		emit("add:insert", PostMetaCacheAdapterContract.addRoute("post", 10, "k", true, false, false));
		emit("add:unique-conflict", PostMetaCacheAdapterContract.addRoute("post", 10, "k", true, true, true));
		emit("update:invalid", PostMetaCacheAdapterContract.updateRoute("post", 10, "", true, 1, false, false, 1));
		emit("update:add-missing", PostMetaCacheAdapterContract.updateRoute("post", 10, "k", true, 0, false, false, 0));
		emit("update:no-change", PostMetaCacheAdapterContract.updateRoute("post", 10, "k", true, 1, true, false, 1));
		emit("update:matched", PostMetaCacheAdapterContract.updateRoute("post", 10, "k", true, 2, false, true, 2));
		emit("update:no-match", PostMetaCacheAdapterContract.updateRoute("post", 10, "k", true, 2, false, true, 0));
		emit("delete:invalid", PostMetaCacheAdapterContract.deleteRoute("post", 0, "k", true, 1, false));
		emit("delete:no-rows", PostMetaCacheAdapterContract.deleteRoute("post", 10, "k", true, 0, false));
		emit("delete:rows", PostMetaCacheAdapterContract.deleteRoute("post", 10, "k", true, 2, false));
		emit("delete:all", PostMetaCacheAdapterContract.deleteRoute("post", 0, "k", true, 4, true));
		emit("get:invalid", PostMetaCacheAdapterContract.getRoute("", 10, "k", true, true, true));
		emit("get:cache-miss", PostMetaCacheAdapterContract.getRoute("post", 10, "k", true, false, false));
		emit("get:all-hit", PostMetaCacheAdapterContract.getRoute("post", 10, "", false, true, false));
		emit("get:key-hit", PostMetaCacheAdapterContract.getRoute("post", 10, "k", true, true, true));
		emit("get:default-single", PostMetaCacheAdapterContract.getRoute("post", 10, "missing", true, true, false));
		emit("get:default-multi", PostMetaCacheAdapterContract.getRoute("post", 10, "missing", false, true, false));
		emit("cache:invalid", PostMetaCacheAdapterContract.updateMetaCacheRoute("post", 0, true, 0));
		emit("cache:all-hit", PostMetaCacheAdapterContract.updateMetaCacheRoute("post", 2, true, 0));
		emit("cache:sql-fill", PostMetaCacheAdapterContract.updateMetaCacheRoute("post", 2, true, 1));
		emit("invalidate:none", PostMetaCacheAdapterContract.invalidationPlan(false, false, 1, false, "post"));
		emit("invalidate:object", PostMetaCacheAdapterContract.invalidationPlan(true, false, 1, false, "post"));
		emit("invalidate:multiple", PostMetaCacheAdapterContract.invalidationPlan(true, true, 4, false, "post"));
		emit("invalidate:post-full", PostMetaCacheAdapterContract.invalidationPlan(true, false, 1, true, "post"));
		emit("invalidate:page-full", PostMetaCacheAdapterContract.invalidationPlan(true, false, 1, true, "page"));
		emit("hook:add", PostMetaCacheAdapterContract.hookPlan("add", false));
		emit("hook:update", PostMetaCacheAdapterContract.hookPlan("update", false));
		emit("hook:delete", PostMetaCacheAdapterContract.hookPlan("delete", false));
		emit("hook:get", PostMetaCacheAdapterContract.hookPlan("get", false));
		emit("hook:cache", PostMetaCacheAdapterContract.hookPlan("cache", false));
		emit("hook:clean-post", PostMetaCacheAdapterContract.hookPlan("clean_post", false));
		emit("hook:short-circuit", PostMetaCacheAdapterContract.hookPlan("add", true));
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
