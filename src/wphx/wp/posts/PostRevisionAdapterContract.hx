package wphx.wp.posts;

using StringTools;

@:keep
class PostRevisionAdapterContract
{
	public static inline final NAME_REVISION = "revision_name";
	public static inline final NAME_AUTOSAVE = "autosave_name";

	public static inline final ROUTE_REVISION_PARENT = "revision_parent";
	public static inline final ROUTE_AUTOSAVE_PARENT = "autosave_parent";
	public static inline final ROUTE_NOT_REVISION = "not_revision";
	public static inline final ROUTE_NOT_AUTOSAVE = "not_autosave";

	public static inline final SAVE_SKIP_AUTOSAVE = "skip_doing_autosave";
	public static inline final SAVE_SKIP_MOVED_TO_AFTER_INSERT = "skip_after_insert_owner";
	public static inline final SAVE_SKIP_MISSING_POST = "skip_missing_post";
	public static inline final SAVE_SKIP_UNSUPPORTED_TYPE = "skip_unsupported_post_type";
	public static inline final SAVE_SKIP_AUTO_DRAFT = "skip_auto_draft";
	public static inline final SAVE_SKIP_DISABLED = "skip_revisions_disabled";
	public static inline final SAVE_SKIP_UNCHANGED = "skip_unchanged_since_latest_revision";
	public static inline final SAVE_CREATE = "create_revision";

	public static inline final PUT_INVALID_POST = "invalid_post";
	public static inline final PUT_REVISION_OF_REVISION = "revision_of_revision";
	public static inline final PUT_INSERT = "insert_revision";

	public static inline final RESTORE_MISSING = "restore_missing_revision";
	public static inline final RESTORE_NO_FIELDS = "restore_no_fields";
	public static inline final RESTORE_UPDATE_FAILED = "restore_update_failed";
	public static inline final RESTORE_UPDATE_POST = "restore_update_post";

	public static inline final DELETE_MISSING = "delete_missing_revision";
	public static inline final DELETE_FAILED = "delete_failed";
	public static inline final DELETE_REVISION = "delete_revision";

	public static inline final RETENTION_DISABLED = "retention_disabled";
	public static inline final RETENTION_UNLIMITED = "retention_unlimited";
	public static inline final RETENTION_KEEP_ALL = "retention_keep_all";
	public static inline final RETENTION_PRUNE_OLDEST = "retention_prune_oldest";

	public static inline final META_NONE = "no_revision_meta";
	public static inline final META_COPY_TO_REVISION = "copy_meta_to_revision";
	public static inline final META_RESTORE_TO_PARENT = "restore_meta_to_parent";
	public static inline final META_COMPARE = "compare_revisioned_meta";

	public static inline final HOOK_NONE = "no_revision_hooks";
	public static inline final HOOK_PUT = "put_revision_hook";
	public static inline final HOOK_RESTORE = "restore_revision_hook";
	public static inline final HOOK_DELETE = "delete_revision_hook";

	public static function revisionPostName(postId:Int, autosave:Bool):String
	{
		return Std.string(postId) + (autosave ? "-autosave-v1" : "-revision-v1");
	}

	public static function revisionNameKind(parentId:Int, postName:String):String
	{
		return postName.contains(Std.string(parentId) + "-autosave") ? NAME_AUTOSAVE : NAME_REVISION;
	}

	public static function isRevisionRoute(foundRevision:Bool, parentId:Int):String
	{
		return foundRevision && parentId > 0 ? ROUTE_REVISION_PARENT : ROUTE_NOT_REVISION;
	}

	public static function isAutosaveRoute(foundRevision:Bool, parentId:Int, postName:String):String
	{
		if (!foundRevision || parentId <= 0)
		{
			return ROUTE_NOT_REVISION;
		}
		return postName.contains(Std.string(parentId) + "-autosave") ? ROUTE_AUTOSAVE_PARENT : ROUTE_NOT_AUTOSAVE;
	}

	public static function saveRoute(doingAutosave:Bool, savingMovedToAfterInsert:Bool, postFound:Bool, supportsRevisions:Bool, status:String,
			revisionsEnabled:Bool, hasLatestRevision:Bool, checkForChanges:Bool, postHasChanged:Bool):String
	{
		if (doingAutosave)
		{
			return SAVE_SKIP_AUTOSAVE;
		}
		if (savingMovedToAfterInsert)
		{
			return SAVE_SKIP_MOVED_TO_AFTER_INSERT;
		}
		if (!postFound)
		{
			return SAVE_SKIP_MISSING_POST;
		}
		if (!supportsRevisions)
		{
			return SAVE_SKIP_UNSUPPORTED_TYPE;
		}
		if (status == "auto-draft")
		{
			return SAVE_SKIP_AUTO_DRAFT;
		}
		if (!revisionsEnabled)
		{
			return SAVE_SKIP_DISABLED;
		}
		if (hasLatestRevision && checkForChanges && !postHasChanged)
		{
			return SAVE_SKIP_UNCHANGED;
		}
		return SAVE_CREATE;
	}

	public static function putRoute(postFound:Bool, postId:Int, postType:String):String
	{
		if (!postFound || postId <= 0)
		{
			return PUT_INVALID_POST;
		}
		return postType == "revision" ? PUT_REVISION_OF_REVISION : PUT_INSERT;
	}

	public static function restoreRoute(revisionFound:Bool, selectedFieldCount:Int, updateSucceeded:Bool):String
	{
		if (!revisionFound)
		{
			return RESTORE_MISSING;
		}
		if (selectedFieldCount <= 0)
		{
			return RESTORE_NO_FIELDS;
		}
		return updateSucceeded ? RESTORE_UPDATE_POST : RESTORE_UPDATE_FAILED;
	}

	public static function deleteRoute(revisionFound:Bool, deleteSucceeded:Bool):String
	{
		if (!revisionFound)
		{
			return DELETE_MISSING;
		}
		return deleteSucceeded ? DELETE_REVISION : DELETE_FAILED;
	}

	public static function retentionPlan(revisionsToKeep:Int, revisionCount:Int):String
	{
		if (revisionsToKeep == 0)
		{
			return RETENTION_DISABLED;
		}
		if (revisionsToKeep < 0)
		{
			return RETENTION_UNLIMITED;
		}
		return revisionCount > revisionsToKeep ? RETENTION_PRUNE_OLDEST : RETENTION_KEEP_ALL;
	}

	public static function revisionsToKeep(rawConstant:Int, constantIsTrue:Bool, supportsRevisions:Bool):Int
	{
		if (!supportsRevisions)
		{
			return 0;
		}
		return constantIsTrue ? -1 : rawConstant;
	}

	public static function metaPlan(operation:String, revisionedMetaKeyCount:Int):String
	{
		if (revisionedMetaKeyCount <= 0)
		{
			return META_NONE;
		}
		return switch operation
		{
			case "save":
				META_COPY_TO_REVISION;
			case "restore":
				META_RESTORE_TO_PARENT;
			case "compare":
				META_COMPARE;
			case _:
				META_NONE;
		}
	}

	public static function hookPlan(operation:String, succeeded:Bool):String
	{
		if (!succeeded)
		{
			return HOOK_NONE;
		}
		return switch operation
		{
			case "put":
				HOOK_PUT;
			case "restore":
				HOOK_RESTORE;
			case "delete":
				HOOK_DELETE;
			case _:
				HOOK_NONE;
		}
	}
}
