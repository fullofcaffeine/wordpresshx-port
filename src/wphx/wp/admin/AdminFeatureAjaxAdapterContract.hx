package wphx.wp.admin;

using StringTools;

/**
	Typed WPHX-316 admin feature/AJAX adapter-contract decisions.

	This module models narrow branch choices for admin-ajax, admin-post,
	settings screens, feature-screen actions, privacy actions, and network-admin
	route intent. It is fixture evidence only; public PHP route files, live Ajax
	responses, database-backed state, and browser/editor behavior remain later
	gates.
**/
@:keep
final AJAX_ACTION_MISSING = "ajax_action_missing";

@:keep
final AJAX_HEARTBEAT = "ajax_heartbeat";

@:keep
final AJAX_MEDIA_ACTION = "ajax_media_action";

@:keep
final AJAX_PRIVILEGED_ACTION = "ajax_privileged_action";

@:keep
final AJAX_NOPRIV_ACTION = "ajax_nopriv_action";

@:keep
final AJAX_DESTRUCTIVE_ACTION = "ajax_destructive_action";

@:keep
final AJAX_ACTION_DENIED = "ajax_action_denied";

@:keep
final ADMIN_POST_ACTION_MISSING = "admin_post_action_missing";

@:keep
final ADMIN_POST_CAPABILITY_DENIED = "admin_post_capability_denied";

@:keep
final ADMIN_POST_NON_POST_METHOD = "admin_post_non_post_method";

@:keep
final ADMIN_POST_HANDLER_MISSING = "admin_post_handler_missing";

@:keep
final ADMIN_POST_REDIRECT = "admin_post_redirect";

@:keep
final ADMIN_POST_DISPATCH = "admin_post_dispatch";

@:keep
final FEATURE_GUARD_CAPABILITY_DENIED = "feature_guard_capability_denied";

@:keep
final FEATURE_GUARD_NONCE_MISSING = "feature_guard_nonce_missing";

@:keep
final FEATURE_GUARD_NONCE_FAILED = "feature_guard_nonce_failed";

@:keep
final FEATURE_GUARD_LOCKED = "feature_guard_locked";

@:keep
final FEATURE_GUARD_READY = "feature_guard_ready";

@:keep
final AJAX_RESPONSE_ERROR = "ajax_response_error";

@:keep
final AJAX_RESPONSE_VALIDATION_FAILED = "ajax_response_validation_failed";

@:keep
final AJAX_RESPONSE_JSON = "ajax_response_json";

@:keep
final AJAX_RESPONSE_XML = "ajax_response_xml";

@:keep
final AJAX_RESPONSE_NO_CONTENT = "ajax_response_no_content";

@:keep
final AJAX_RESPONSE_HTML = "ajax_response_html";

@:keep
final SETTINGS_CAPABILITY_DENIED = "settings_capability_denied";

@:keep
final SETTINGS_NETWORK_OPTIONS = "settings_network_options";

@:keep
final SETTINGS_RENDER_FORM = "settings_render_form";

@:keep
final SETTINGS_SAVE_OPTIONS = "settings_save_options";

@:keep
final SETTINGS_IDLE = "settings_idle";

@:keep
final CONTENT_ACTION_MISSING_OBJECT = "content_action_missing_object";

@:keep
final CONTENT_ACTION_AUTOSAVE = "content_action_autosave";

@:keep
final CONTENT_ACTION_BULK = "content_action_bulk";

@:keep
final CONTENT_ACTION_POST = "content_action_post";

@:keep
final CONTENT_ACTION_TERM = "content_action_term";

@:keep
final CONTENT_ACTION_COMMENT = "content_action_comment";

@:keep
final CONTENT_ACTION_UNKNOWN = "content_action_unknown";

@:keep
final PRIVACY_ACTION_MISSING_REQUEST = "privacy_action_missing_request";

@:keep
final PRIVACY_AJAX_EXPORT = "privacy_ajax_export";

@:keep
final PRIVACY_AJAX_ERASE = "privacy_ajax_erase";

@:keep
final PRIVACY_EMAIL_REQUEST = "privacy_email_request";

@:keep
final PRIVACY_EXPORT_SCREEN = "privacy_export_screen";

@:keep
final PRIVACY_ERASE_SCREEN = "privacy_erase_screen";

@:keep
final PRIVACY_OVERVIEW = "privacy_overview";

@:keep
final NETWORK_NOT_NETWORK_ADMIN = "network_not_network_admin";

@:keep
final NETWORK_CAPABILITY_DENIED = "network_capability_denied";

@:keep
final NETWORK_SITE_CONTEXT = "network_site_context";

@:keep
final NETWORK_USER_CONTEXT = "network_user_context";

@:keep
final NETWORK_ACTION_DISPATCH = "network_action_dispatch";

@:keep
final NETWORK_DASHBOARD = "network_dashboard";

/**
	Chooses admin-ajax action intent before public PHP dispatches hooks, includes
	action files, sends headers, or terminates via `wp_die`.
**/
@:keep
function ajaxActionPlan(action:String, loggedIn:Bool, registeredPriv:Bool, registeredNopriv:Bool, mediaAction:Bool, destructiveAction:Bool):String
{
	final normalized = action.trim();
	if (normalized == "")
	{
		return AJAX_ACTION_MISSING;
	}
	if (normalized == "heartbeat")
	{
		return AJAX_HEARTBEAT;
	}
	if (mediaAction)
	{
		return AJAX_MEDIA_ACTION;
	}
	if (loggedIn && registeredPriv)
	{
		return destructiveAction ? AJAX_DESTRUCTIVE_ACTION : AJAX_PRIVILEGED_ACTION;
	}
	if (!loggedIn && registeredNopriv)
	{
		return AJAX_NOPRIV_ACTION;
	}
	return AJAX_ACTION_DENIED;
}

/**
	Routes admin-post action intent while concrete redirects, hooks, and global
	request state remain public PHP adapter work.
**/
@:keep
function adminPostActionPlan(action:String, method:String, canAccess:Bool, hasHandler:Bool, hasRedirect:Bool):String
{
	if (action.trim() == "")
	{
		return ADMIN_POST_ACTION_MISSING;
	}
	if (!canAccess)
	{
		return ADMIN_POST_CAPABILITY_DENIED;
	}
	if (method.toUpperCase() != "POST")
	{
		return ADMIN_POST_NON_POST_METHOD;
	}
	if (!hasHandler)
	{
		return ADMIN_POST_HANDLER_MISSING;
	}
	return hasRedirect ? ADMIN_POST_REDIRECT : ADMIN_POST_DISPATCH;
}

/**
	Models shared admin feature guards before nonce functions, capability APIs,
	post locks, and callbacks execute in the PHP host.
**/
@:keep
function featureGuardPlan(canAccess:Bool, nonceRequired:Bool, noncePresent:Bool, nonceValid:Bool, lockedByAnotherUser:Bool):String
{
	if (!canAccess)
	{
		return FEATURE_GUARD_CAPABILITY_DENIED;
	}
	if (nonceRequired && !noncePresent)
	{
		return FEATURE_GUARD_NONCE_MISSING;
	}
	if (nonceRequired && !nonceValid)
	{
		return FEATURE_GUARD_NONCE_FAILED;
	}
	if (lockedByAnotherUser)
	{
		return FEATURE_GUARD_LOCKED;
	}
	return FEATURE_GUARD_READY;
}

/**
	Selects the intended Ajax response family without claiming header emission,
	JSON encoding details, XML response shape, or `wp_die` behavior.
**/
@:keep
function ajaxResponsePlan(wantsJson:Bool, wantsXml:Bool, hasError:Bool, validationFailed:Bool, noContent:Bool):String
{
	if (hasError)
	{
		return AJAX_RESPONSE_ERROR;
	}
	if (validationFailed)
	{
		return AJAX_RESPONSE_VALIDATION_FAILED;
	}
	if (wantsJson)
	{
		return AJAX_RESPONSE_JSON;
	}
	if (wantsXml)
	{
		return AJAX_RESPONSE_XML;
	}
	return noContent ? AJAX_RESPONSE_NO_CONTENT : AJAX_RESPONSE_HTML;
}

/**
	Names settings/options screen intent while option registration, sanitization,
	autoload policy, redirects, and multisite storage remain neighboring gates.
**/
@:keep
function settingsScreenPlan(optionPage:String, method:String, canManageOptions:Bool, dirtySettings:Bool, networkOptions:Bool):String
{
	if (!canManageOptions)
	{
		return SETTINGS_CAPABILITY_DENIED;
	}
	if (networkOptions)
	{
		return SETTINGS_NETWORK_OPTIONS;
	}
	if (method.toUpperCase() != "POST")
	{
		return optionPage.trim() == "" ? SETTINGS_IDLE : SETTINGS_RENDER_FORM;
	}
	return dirtySettings ? SETTINGS_SAVE_OPTIONS : SETTINGS_IDLE;
}

/**
	Classifies feature-screen actions over content objects without taking
	ownership of post, term, comment, query, cache, or list-table semantics.
**/
@:keep
function contentFeatureActionPlan(objectType:String, action:String, hasObject:Bool, autosave:Bool, bulkAction:Bool):String
{
	if (!hasObject)
	{
		return CONTENT_ACTION_MISSING_OBJECT;
	}
	if (autosave)
	{
		return CONTENT_ACTION_AUTOSAVE;
	}
	if (bulkAction || action == "bulk")
	{
		return CONTENT_ACTION_BULK;
	}
	return switch objectType.trim()
	{
		case "post": CONTENT_ACTION_POST;
		case "term": CONTENT_ACTION_TERM;
		case "comment": CONTENT_ACTION_COMMENT;
		case _: CONTENT_ACTION_UNKNOWN;
	}
}

/**
	Routes privacy export/erase screen and Ajax intent while mail, data exporter,
	eraser, list-table, and persistence behavior stay in their source domains.
**/
@:keep
function privacyActionPlan(action:String, ajax:Bool, hasRequest:Bool, sendEmail:Bool):String
{
	if (!hasRequest)
	{
		return PRIVACY_ACTION_MISSING_REQUEST;
	}
	if (ajax && action == "export")
	{
		return PRIVACY_AJAX_EXPORT;
	}
	if (ajax && action == "erase")
	{
		return PRIVACY_AJAX_ERASE;
	}
	if (sendEmail)
	{
		return PRIVACY_EMAIL_REQUEST;
	}
	if (action == "export")
	{
		return PRIVACY_EXPORT_SCREEN;
	}
	return action == "erase" ? PRIVACY_ERASE_SCREEN : PRIVACY_OVERVIEW;
}

/**
	Names network-admin route intent while multisite storage, site/user state,
	network list tables, and network bootstrap behavior remain WPHX-317 work.
**/
@:keep
function networkAdminPlan(isNetworkAdmin:Bool, canManageNetwork:Bool, hasSiteContext:Bool, hasUserContext:Bool, hasAction:Bool):String
{
	if (!isNetworkAdmin)
	{
		return NETWORK_NOT_NETWORK_ADMIN;
	}
	if (!canManageNetwork)
	{
		return NETWORK_CAPABILITY_DENIED;
	}
	if (hasSiteContext)
	{
		return NETWORK_SITE_CONTEXT;
	}
	if (hasUserContext)
	{
		return NETWORK_USER_CONTEXT;
	}
	return hasAction ? NETWORK_ACTION_DISPATCH : NETWORK_DASHBOARD;
}
