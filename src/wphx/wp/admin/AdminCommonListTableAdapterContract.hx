package wphx.wp.admin;

using StringTools;

/**
	Typed WPHX-315 admin common/list-table adapter contract decisions.

	This module models narrow branch choices exposed by admin bootstrap state,
	current-screen setup, list-table routing, menu registration, admin notices,
	and capability/nonce guard intent. It is not a public PHP implementation and
	does not own feature screens, admin Ajax, installed admin behavior, or browser
	editor flows.
**/
@:keep
final REQUEST_ACCESS_DENIED = "admin_request_access_denied";

@:keep
final REQUEST_NETWORK_ADMIN = "admin_request_network_admin";

@:keep
final REQUEST_USER_ADMIN = "admin_request_user_admin";

@:keep
final REQUEST_DO_ACTION = "admin_request_do_action";

@:keep
final REQUEST_SCREEN_BOUND = "admin_request_screen_bound";

@:keep
final REQUEST_DASHBOARD = "admin_request_dashboard";

@:keep
final SCREEN_MISSING = "screen_missing";

@:keep
final SCREEN_LIST_TABLE = "screen_list_table";

@:keep
final SCREEN_OPTIONS = "screen_options";

@:keep
final SCREEN_HELP = "screen_help";

@:keep
final SCREEN_CURRENT = "screen_current";

@:keep
final LIST_TABLE_EMPTY = "list_table_empty";

@:keep
final LIST_TABLE_BULK_ACTION = "list_table_bulk_action";

@:keep
final LIST_TABLE_ROW_ACTION = "list_table_row_action";

@:keep
final LIST_TABLE_PAGE_CLAMPED = "list_table_page_clamped";

@:keep
final LIST_TABLE_HIDDEN_COLUMNS = "list_table_hidden_columns";

@:keep
final LIST_TABLE_SEARCH_FILTER = "list_table_search_filter";

@:keep
final LIST_TABLE_DISPLAY = "list_table_display";

@:keep
final MENU_CAPABILITY_HIDDEN = "menu_capability_hidden";

@:keep
final MENU_DUPLICATE_SLUG = "menu_duplicate_slug";

@:keep
final MENU_ORPHAN_SUBMENU = "menu_orphan_submenu";

@:keep
final MENU_SUBMENU_REGISTERED = "menu_submenu_registered";

@:keep
final MENU_POSITION_REORDERED = "menu_position_reordered";

@:keep
final MENU_TOP_REGISTERED = "menu_top_registered";

@:keep
final NOTICE_SUPPRESSED = "notice_suppressed";

@:keep
final NOTICE_STORED = "notice_stored";

@:keep
final NOTICE_DISMISSIBLE = "notice_dismissible";

@:keep
final NOTICE_ESCAPED = "notice_escaped";

@:keep
final NOTICE_SUCCESS = "notice_success";

@:keep
final NOTICE_WARNING = "notice_warning";

@:keep
final NOTICE_ERROR = "notice_error";

@:keep
final NOTICE_INFO = "notice_info";

@:keep
final GUARD_CAPABILITY_DENIED = "guard_capability_denied";

@:keep
final GUARD_NONCE_MISSING = "guard_nonce_missing";

@:keep
final GUARD_NONCE_FAILED = "guard_nonce_failed";

@:keep
final GUARD_HOOK_SHORT_CIRCUIT = "guard_hook_short_circuit";

@:keep
final GUARD_READY = "guard_ready";

@:keep
final OUTPUT_HEADER = "output_header";

@:keep
final OUTPUT_NOTICE_STACK = "output_notice_stack";

@:keep
final OUTPUT_LIST_TABLE = "output_list_table";

@:keep
final OUTPUT_FOOTER = "output_footer";

@:keep
final OUTPUT_COMPLETE = "output_complete";

/**
	Chooses the admin request route before a public PHP adapter mutates globals,
	loads screen files, or dispatches admin actions.
**/
@:keep
function adminRequestPlan(canAccess:Bool, isNetworkAdmin:Bool, isUserAdmin:Bool, hasAction:Bool, hasCurrentScreen:Bool):String
{
	if (!canAccess)
	{
		return REQUEST_ACCESS_DENIED;
	}
	if (isNetworkAdmin)
	{
		return REQUEST_NETWORK_ADMIN;
	}
	if (isUserAdmin)
	{
		return REQUEST_USER_ADMIN;
	}
	if (hasAction)
	{
		return REQUEST_DO_ACTION;
	}
	return hasCurrentScreen ? REQUEST_SCREEN_BOUND : REQUEST_DASHBOARD;
}

/**
	Models current-screen setup intent while concrete `WP_Screen` objects, help
	tabs, option storage, globals, and callback execution remain PHP adapter work.
**/
@:keep
function screenSetupPlan(screenId:String, hasCurrentScreen:Bool, hasHelpTabs:Bool, hasScreenOptions:Bool, isListTable:Bool):String
{
	if (!hasCurrentScreen || screenId.trim() == "")
	{
		return SCREEN_MISSING;
	}
	if (isListTable)
	{
		return SCREEN_LIST_TABLE;
	}
	if (hasScreenOptions)
	{
		return SCREEN_OPTIONS;
	}
	return hasHelpTabs ? SCREEN_HELP : SCREEN_CURRENT;
}

/**
	Routes list-table display intent before public PHP owns SQL queries,
	row-action links, pagination links, hidden-column storage, and output.
**/
@:keep
function listTablePlan(hasItems:Bool, hasSearch:Bool, bulkAction:String, rowActionRequested:Bool, currentPage:Int, totalPages:Int, hiddenColumnCount:Int):String
{
	if (!hasItems)
	{
		return LIST_TABLE_EMPTY;
	}
	if (bulkAction.trim() != "" && bulkAction != "-1")
	{
		return LIST_TABLE_BULK_ACTION;
	}
	if (rowActionRequested)
	{
		return LIST_TABLE_ROW_ACTION;
	}
	if (totalPages > 0 && currentPage > totalPages)
	{
		return LIST_TABLE_PAGE_CLAMPED;
	}
	if (hiddenColumnCount > 0)
	{
		return LIST_TABLE_HIDDEN_COLUMNS;
	}
	return hasSearch ? LIST_TABLE_SEARCH_FILTER : LIST_TABLE_DISPLAY;
}

/**
	Names menu/submenu registration intent while public PHP keeps global menu
	arrays, slug normalization, capability checks, hook suffixes, and output.
**/
@:keep
function menuRegistrationPlan(hasCapability:Bool, parentSlug:String, submenuRequested:Bool, duplicateSlug:Bool, positionConflict:Bool):String
{
	if (!hasCapability)
	{
		return MENU_CAPABILITY_HIDDEN;
	}
	if (duplicateSlug)
	{
		return MENU_DUPLICATE_SLUG;
	}
	if (submenuRequested && parentSlug.trim() == "")
	{
		return MENU_ORPHAN_SUBMENU;
	}
	if (submenuRequested)
	{
		return MENU_SUBMENU_REGISTERED;
	}
	return positionConflict ? MENU_POSITION_REORDERED : MENU_TOP_REGISTERED;
}

/**
	Chooses admin notice rendering intent before public PHP escapes text, applies
	notice filters, stores settings errors, and emits markup.
**/
@:keep
function adminNoticePlan(noticeType:String, messagePresent:Bool, dismissible:Bool, storedForLater:Bool, htmlAllowed:Bool):String
{
	if (!messagePresent)
	{
		return NOTICE_SUPPRESSED;
	}
	if (storedForLater)
	{
		return NOTICE_STORED;
	}
	if (dismissible)
	{
		return NOTICE_DISMISSIBLE;
	}
	if (!htmlAllowed)
	{
		return NOTICE_ESCAPED;
	}
	return switch noticeType.trim().toLowerCase()
	{
		case "success": NOTICE_SUCCESS;
		case "warning": NOTICE_WARNING;
		case "error": NOTICE_ERROR;
		default: NOTICE_INFO;
	};
}

/**
	Routes guard intent for capability, nonce, and hook short-circuit checks
	without owning WordPress user state, nonce generation, or hook execution.
**/
@:keep
function adminGuardPlan(canAccess:Bool, noncePresent:Bool, nonceValid:Bool, hookAllowed:Bool):String
{
	if (!canAccess)
	{
		return GUARD_CAPABILITY_DENIED;
	}
	if (!noncePresent)
	{
		return GUARD_NONCE_MISSING;
	}
	if (!nonceValid)
	{
		return GUARD_NONCE_FAILED;
	}
	return hookAllowed ? GUARD_READY : GUARD_HOOK_SHORT_CIRCUIT;
}

/**
	Models common admin output phase selection while header/footer files,
	screen-meta output, notices, list-table HTML, scripts, and buffering remain
	public PHP responsibilities.
**/
@:keep
function outputFragmentPlan(headerSent:Bool, noticeCount:Int, listTableRequested:Bool, footerRequested:Bool):String
{
	if (!headerSent)
	{
		return OUTPUT_HEADER;
	}
	if (noticeCount > 0)
	{
		return OUTPUT_NOTICE_STACK;
	}
	if (listTableRequested)
	{
		return OUTPUT_LIST_TABLE;
	}
	return footerRequested ? OUTPUT_FOOTER : OUTPUT_COMPLETE;
}
