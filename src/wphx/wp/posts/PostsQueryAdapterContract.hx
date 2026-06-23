package wphx.wp.posts;

using StringTools;

@:keep
class PostsQueryAdapterContract
{
	public static inline final SEMANTIC_OWNER_HAXE = "haxe";
	public static inline final ADAPTER_CONTRACT_OWNER_HAXE_TYPED = "haxe_typed";
	public static inline final EMISSION_STRATEGY_STOCK_HAXE_PHP = "stock_haxe_php_private_impl";
	public static inline final EXECUTION_PROVIDER_HAXE_PHP = "haxe_php";
	public static inline final EVIDENCE_TARGETED_SEMANTIC_PARITY = "targeted_semantic_parity";

	public static inline final QUERY_PAGINATION = "pagination";
	public static inline final QUERY_ORDERING = "ordering";
	public static inline final QUERY_CONTENT_FILTER = "content_filter";
	public static inline final QUERY_AUTHOR_FILTER = "author_filter";
	public static inline final QUERY_TAXONOMY_FILTER = "taxonomy_filter";
	public static inline final QUERY_META_FILTER = "meta_filter";
	public static inline final QUERY_DATE_FILTER = "date_filter";
	public static inline final QUERY_SEARCH = "search";
	public static inline final QUERY_STATUS = "post_status";
	public static inline final QUERY_POST_TYPE = "post_type";
	public static inline final QUERY_UNKNOWN = "unknown";

	public static inline final STATUS_PUBLIC = "public";
	public static inline final STATUS_PRIVATE = "private";
	public static inline final STATUS_SCHEDULED = "scheduled";
	public static inline final STATUS_DRAFT_LIKE = "draft_like";
	public static inline final STATUS_TRASHED = "trashed";
	public static inline final STATUS_REVISION = "revision";
	public static inline final STATUS_CUSTOM = "custom";

	public static inline final LIFECYCLE_NO_CHANGE = "no_change";
	public static inline final LIFECYCLE_BECOMES_PUBLIC = "becomes_public";
	public static inline final LIFECYCLE_LEAVES_PUBLIC = "leaves_public";
	public static inline final LIFECYCLE_TRASH = "trash";
	public static inline final LIFECYCLE_RESTORE = "restore";
	public static inline final LIFECYCLE_REVISION = "revision";
	public static inline final LIFECYCLE_STATUS_CHANGE = "status_change";

	public static inline final META_POST = "post_meta";
	public static inline final META_REVISION_PARENT_POST = "revision_parent_post_meta";
	public static inline final META_UNSUPPORTED = "unsupported_meta";

	public static inline final CACHE_NONE = "none";
	public static inline final CACHE_POST = "post_cache";
	public static inline final CACHE_POST_META = "post_and_meta_cache";
	public static inline final CACHE_POST_QUERY = "post_and_query_cache";
	public static inline final CACHE_POST_META_QUERY = "post_meta_and_query_cache";

	static final PAGINATION_VARS = [
		"p",
		"page_id",
		"name",
		"pagename",
		"post__in",
		"post__not_in",
		"posts_per_page",
		"paged",
		"offset"
	];
	static final ORDERING_VARS = ["orderby", "order", "meta_key"];
	static final CONTENT_FILTER_VARS = ["post_parent", "post_parent__in", "post_parent__not_in", "post_name__in"];
	static final AUTHOR_FILTER_VARS = ["author", "author_name", "author__in", "author__not_in"];
	static final TAXONOMY_FILTER_VARS = [
		"cat",
		"category_name",
		"category__in",
		"category__not_in",
		"tag",
		"tag_id",
		"tag__in",
		"tag__not_in",
		"tax_query"
	];
	static final META_FILTER_VARS = ["meta_key", "meta_value", "meta_value_num", "meta_compare", "meta_query"];
	static final DATE_FILTER_VARS = ["year", "monthnum", "w", "day", "hour", "minute", "second", "m", "date_query"];
	static final SEARCH_VARS = ["s", "sentence", "exact", "search_columns"];

	public static function semanticOwner():String
	{
		return SEMANTIC_OWNER_HAXE;
	}

	public static function adapterContractOwner():String
	{
		return ADAPTER_CONTRACT_OWNER_HAXE_TYPED;
	}

	public static function emissionStrategy():String
	{
		return EMISSION_STRATEGY_STOCK_HAXE_PHP;
	}

	public static function executionProvider():String
	{
		return EXECUTION_PROVIDER_HAXE_PHP;
	}

	public static function compatibilityEvidence():String
	{
		return EVIDENCE_TARGETED_SEMANTIC_PARITY;
	}

	public static function queryVarKind(queryVar:String):String
	{
		if (contains(PAGINATION_VARS, queryVar))
		{
			return QUERY_PAGINATION;
		}
		if (contains(ORDERING_VARS, queryVar))
		{
			return QUERY_ORDERING;
		}
		if (contains(CONTENT_FILTER_VARS, queryVar))
		{
			return QUERY_CONTENT_FILTER;
		}
		if (contains(AUTHOR_FILTER_VARS, queryVar))
		{
			return QUERY_AUTHOR_FILTER;
		}
		if (contains(TAXONOMY_FILTER_VARS, queryVar))
		{
			return QUERY_TAXONOMY_FILTER;
		}
		if (contains(META_FILTER_VARS, queryVar))
		{
			return QUERY_META_FILTER;
		}
		if (contains(DATE_FILTER_VARS, queryVar))
		{
			return QUERY_DATE_FILTER;
		}
		if (contains(SEARCH_VARS, queryVar))
		{
			return QUERY_SEARCH;
		}
		if (queryVar == "post_status")
		{
			return QUERY_STATUS;
		}
		if (queryVar == "post_type")
		{
			return QUERY_POST_TYPE;
		}
		return QUERY_UNKNOWN;
	}

	public static function normalizeQueryOrder(order:String):String
	{
		return order != "" && order.toUpperCase() == "ASC" ? "ASC" : "DESC";
	}

	public static function statusFamily(status:String):String
	{
		return switch status
		{
			case "publish":
				STATUS_PUBLIC;
			case "private":
				STATUS_PRIVATE;
			case "future":
				STATUS_SCHEDULED;
			case "draft" | "pending" | "auto-draft":
				STATUS_DRAFT_LIKE;
			case "trash":
				STATUS_TRASHED;
			case "inherit":
				STATUS_REVISION;
			case _:
				STATUS_CUSTOM;
		}
	}

	public static function lifecycleRoute(oldStatus:String, newStatus:String):String
	{
		if (oldStatus == newStatus)
		{
			return LIFECYCLE_NO_CHANGE;
		}
		if (statusFamily(newStatus) == STATUS_REVISION || statusFamily(oldStatus) == STATUS_REVISION)
		{
			return LIFECYCLE_REVISION;
		}
		if (newStatus == "trash")
		{
			return LIFECYCLE_TRASH;
		}
		if (oldStatus == "trash")
		{
			return LIFECYCLE_RESTORE;
		}
		if (statusFamily(newStatus) == STATUS_PUBLIC)
		{
			return LIFECYCLE_BECOMES_PUBLIC;
		}
		if (statusFamily(oldStatus) == STATUS_PUBLIC)
		{
			return LIFECYCLE_LEAVES_PUBLIC;
		}
		return LIFECYCLE_STATUS_CHANGE;
	}

	public static function metadataRoute(metaType:String, objectIsRevision:Bool):String
	{
		if (metaType != "post")
		{
			return META_UNSUPPORTED;
		}
		return objectIsRevision ? META_REVISION_PARENT_POST : META_POST;
	}

	public static function cacheInvalidationPlan(postChanged:Bool, metaChanged:Bool, queryAffectingChange:Bool):String
	{
		if (!postChanged && !metaChanged)
		{
			return CACHE_NONE;
		}
		if (postChanged && metaChanged && queryAffectingChange)
		{
			return CACHE_POST_META_QUERY;
		}
		if (postChanged && queryAffectingChange)
		{
			return CACHE_POST_QUERY;
		}
		if (postChanged || metaChanged)
		{
			return metaChanged ? CACHE_POST_META : CACHE_POST;
		}
		return CACHE_NONE;
	}

	static function contains(values:Array<String>, value:String):Bool
	{
		for (item in values)
		{
			if (item == value)
			{
				return true;
			}
		}
		return false;
	}
}
