package wphx.fixtures.wp.core;

import wphx.wp.posts.PostsQueryAdapterContract;

@:keep
class PostsQueryAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("semantic_owner", PostsQueryAdapterContract.semanticOwner());
		emit("adapter_contract_owner", PostsQueryAdapterContract.adapterContractOwner());
		emit("emission_strategy", PostsQueryAdapterContract.emissionStrategy());
		emit("execution_provider", PostsQueryAdapterContract.executionProvider());
		emit("compatibility_evidence", PostsQueryAdapterContract.compatibilityEvidence());
		emit("query:paged", PostsQueryAdapterContract.queryVarKind("paged"));
		emit("query:orderby", PostsQueryAdapterContract.queryVarKind("orderby"));
		emit("query:post_parent", PostsQueryAdapterContract.queryVarKind("post_parent"));
		emit("query:author__in", PostsQueryAdapterContract.queryVarKind("author__in"));
		emit("query:tax_query", PostsQueryAdapterContract.queryVarKind("tax_query"));
		emit("query:meta_query", PostsQueryAdapterContract.queryVarKind("meta_query"));
		emit("query:date_query", PostsQueryAdapterContract.queryVarKind("date_query"));
		emit("query:s", PostsQueryAdapterContract.queryVarKind("s"));
		emit("query:post_status", PostsQueryAdapterContract.queryVarKind("post_status"));
		emit("query:post_type", PostsQueryAdapterContract.queryVarKind("post_type"));
		emit("query:unknown", PostsQueryAdapterContract.queryVarKind("unknown_probe"));
		emit("order:empty", PostsQueryAdapterContract.normalizeQueryOrder(""));
		emit("order:asc-lower", PostsQueryAdapterContract.normalizeQueryOrder("asc"));
		emit("order:garbage", PostsQueryAdapterContract.normalizeQueryOrder("sideways"));
		emit("status:publish", PostsQueryAdapterContract.statusFamily("publish"));
		emit("status:private", PostsQueryAdapterContract.statusFamily("private"));
		emit("status:future", PostsQueryAdapterContract.statusFamily("future"));
		emit("status:draft", PostsQueryAdapterContract.statusFamily("draft"));
		emit("status:trash", PostsQueryAdapterContract.statusFamily("trash"));
		emit("status:inherit", PostsQueryAdapterContract.statusFamily("inherit"));
		emit("status:custom", PostsQueryAdapterContract.statusFamily("custom-status"));
		emit("lifecycle:no-change", PostsQueryAdapterContract.lifecycleRoute("draft", "draft"));
		emit("lifecycle:publish", PostsQueryAdapterContract.lifecycleRoute("draft", "publish"));
		emit("lifecycle:unpublish", PostsQueryAdapterContract.lifecycleRoute("publish", "draft"));
		emit("lifecycle:trash", PostsQueryAdapterContract.lifecycleRoute("publish", "trash"));
		emit("lifecycle:restore", PostsQueryAdapterContract.lifecycleRoute("trash", "draft"));
		emit("lifecycle:revision", PostsQueryAdapterContract.lifecycleRoute("publish", "inherit"));
		emit("meta:post", PostsQueryAdapterContract.metadataRoute("post", false));
		emit("meta:revision", PostsQueryAdapterContract.metadataRoute("post", true));
		emit("meta:unsupported", PostsQueryAdapterContract.metadataRoute("comment", false));
		emit("cache:none", PostsQueryAdapterContract.cacheInvalidationPlan(false, false, false));
		emit("cache:post", PostsQueryAdapterContract.cacheInvalidationPlan(true, false, false));
		emit("cache:meta", PostsQueryAdapterContract.cacheInvalidationPlan(false, true, false));
		emit("cache:post-query", PostsQueryAdapterContract.cacheInvalidationPlan(true, false, true));
		emit("cache:post-meta-query", PostsQueryAdapterContract.cacheInvalidationPlan(true, true, true));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
