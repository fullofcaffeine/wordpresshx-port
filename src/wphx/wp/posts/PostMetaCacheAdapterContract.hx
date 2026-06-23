package wphx.wp.posts;

@:keep
class PostMetaCacheAdapterContract
{
	public static inline final OBJECT_POST = "post_object";
	public static inline final OBJECT_REVISION_PARENT = "revision_parent_post";

	public static inline final META_INVALID = "invalid_meta_request";
	public static inline final META_ADD_INSERT = "add_meta_insert";
	public static inline final META_ADD_UNIQUE_CONFLICT = "add_meta_unique_conflict";
	public static inline final META_UPDATE_ADD_MISSING = "update_meta_add_missing";
	public static inline final META_UPDATE_NO_CHANGE = "update_meta_no_change";
	public static inline final META_UPDATE_ROWS = "update_meta_rows";
	public static inline final META_DELETE_NO_ROWS = "delete_meta_no_rows";
	public static inline final META_DELETE_ROWS = "delete_meta_rows";
	public static inline final META_DELETE_ALL_ROWS = "delete_meta_all_rows";

	public static inline final GET_INVALID = "get_meta_invalid";
	public static inline final GET_CACHE_HIT = "get_meta_cache_hit";
	public static inline final GET_CACHE_MISS = "get_meta_cache_miss";
	public static inline final GET_DEFAULT_SINGLE = "get_meta_default_single";
	public static inline final GET_DEFAULT_MULTI = "get_meta_default_multi";

	public static inline final CACHE_INVALID = "cache_invalid";
	public static inline final CACHE_ALL_HIT = "cache_all_hit";
	public static inline final CACHE_SQL_FILL = "cache_sql_fill";

	public static inline final INVALIDATE_NONE = "invalidate_none";
	public static inline final INVALIDATE_OBJECT_META = "invalidate_object_meta";
	public static inline final INVALIDATE_MULTIPLE_OBJECT_META = "invalidate_multiple_object_meta";
	public static inline final INVALIDATE_POST_FULL = "invalidate_post_full";
	public static inline final INVALIDATE_PAGE_FULL = "invalidate_page_full";

	public static inline final HOOK_ADD_META = "add_post_meta_hooks";
	public static inline final HOOK_UPDATE_META = "update_post_meta_hooks";
	public static inline final HOOK_DELETE_META = "delete_post_meta_hooks";
	public static inline final HOOK_GET_META = "get_post_meta_filter";
	public static inline final HOOK_CACHE_META = "update_post_metadata_cache_filter";
	public static inline final HOOK_CLEAN_POST_CACHE = "clean_post_cache_hooks";
	public static inline final HOOK_NONE = "no_meta_hooks";

	public static function objectRoute(isRevision:Bool):String
	{
		return isRevision ? OBJECT_REVISION_PARENT : OBJECT_POST;
	}

	public static function routedObjectId(postId:Int, revisionParentId:Int):Int
	{
		return revisionParentId > 0 ? revisionParentId : postId;
	}

	public static function addRoute(metaType:String, objectId:Int, metaKey:String, tableExists:Bool, unique:Bool, keyAlreadyExists:Bool):String
	{
		if (!validMetaRequest(metaType, objectId, metaKey, tableExists))
		{
			return META_INVALID;
		}
		if (unique && keyAlreadyExists)
		{
			return META_ADD_UNIQUE_CONFLICT;
		}
		return META_ADD_INSERT;
	}

	public static function updateRoute(metaType:String, objectId:Int, metaKey:String, tableExists:Bool, existingRows:Int, sameSingleValue:Bool,
			prevValueProvided:Bool, matchedRows:Int):String
	{
		if (!validMetaRequest(metaType, objectId, metaKey, tableExists))
		{
			return META_INVALID;
		}
		if (existingRows == 0)
		{
			return META_UPDATE_ADD_MISSING;
		}
		if (!prevValueProvided && existingRows == 1 && sameSingleValue)
		{
			return META_UPDATE_NO_CHANGE;
		}
		return matchedRows > 0 ? META_UPDATE_ROWS : META_UPDATE_NO_CHANGE;
	}

	public static function deleteRoute(metaType:String, objectId:Int, metaKey:String, tableExists:Bool, matchedRows:Int, deleteAll:Bool):String
	{
		if (!tableExists || metaType == "" || metaKey == "" || (!deleteAll && objectId <= 0))
		{
			return META_INVALID;
		}
		if (matchedRows <= 0)
		{
			return META_DELETE_NO_ROWS;
		}
		return deleteAll ? META_DELETE_ALL_ROWS : META_DELETE_ROWS;
	}

	public static function getRoute(metaType:String, objectId:Int, metaKey:String, single:Bool, cachePresent:Bool, keyExists:Bool):String
	{
		if (metaType == "" || objectId <= 0)
		{
			return GET_INVALID;
		}
		if (!cachePresent)
		{
			return GET_CACHE_MISS;
		}
		if (metaKey == "" || keyExists)
		{
			return GET_CACHE_HIT;
		}
		return single ? GET_DEFAULT_SINGLE : GET_DEFAULT_MULTI;
	}

	public static function updateMetaCacheRoute(metaType:String, objectCount:Int, tableExists:Bool, nonCachedCount:Int):String
	{
		if (metaType == "" || objectCount <= 0 || !tableExists)
		{
			return CACHE_INVALID;
		}
		return nonCachedCount <= 0 ? CACHE_ALL_HIT : CACHE_SQL_FILL;
	}

	public static function invalidationPlan(writeSucceeded:Bool, deleteAll:Bool, affectedObjectCount:Int, cleanWholePost:Bool, postType:String):String
	{
		if (!writeSucceeded)
		{
			return INVALIDATE_NONE;
		}
		if (cleanWholePost)
		{
			return postType == "page" ? INVALIDATE_PAGE_FULL : INVALIDATE_POST_FULL;
		}
		if (deleteAll || affectedObjectCount > 1)
		{
			return INVALIDATE_MULTIPLE_OBJECT_META;
		}
		return INVALIDATE_OBJECT_META;
	}

	public static function hookPlan(operation:String, shortCircuited:Bool):String
	{
		if (shortCircuited)
		{
			return HOOK_NONE;
		}
		return switch operation
		{
			case "add":
				HOOK_ADD_META;
			case "update":
				HOOK_UPDATE_META;
			case "delete":
				HOOK_DELETE_META;
			case "get":
				HOOK_GET_META;
			case "cache":
				HOOK_CACHE_META;
			case "clean_post":
				HOOK_CLEAN_POST_CACHE;
			case _:
				HOOK_NONE;
		}
	}

	static function validMetaRequest(metaType:String, objectId:Int, metaKey:String, tableExists:Bool):Bool
	{
		return metaType != "" && objectId > 0 && metaKey != "" && tableExists;
	}
}
