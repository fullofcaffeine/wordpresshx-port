package wphx.wp.updates;

using StringTools;

/**
	Typed WPHX-319 updates, installers, upgrader, and recovery-mode
	adapter-contract decisions.

	This module models narrow branch intent for update API checks, core/plugin/
	language update actions, upgrader skin output phases, install bootstrap,
	network update wrappers, automatic update/Site Health checks, and recovery
	cookie/key/link guards. It is fixture evidence only; public PHP replacement,
	live filesystem/network/database side effects, installed update execution,
	and recovery email/session parity remain later gates.
**/
@:keep
final UPDATE_CHECK_DISABLED = "update_check_disabled";

@:keep
final UPDATE_CHECK_TRANSIENT_HIT = "update_check_transient_hit";

@:keep
final UPDATE_CHECK_REMOTE_BLOCKED = "update_check_remote_blocked";

@:keep
final UPDATE_CHECK_FORCE_REMOTE = "update_check_force_remote";

@:keep
final UPDATE_CHECK_REMOTE_ALLOWED = "update_check_remote_allowed";

@:keep
final CORE_UPDATE_NONE = "core_update_none";

@:keep
final CORE_UPDATE_MINOR = "core_update_minor";

@:keep
final CORE_UPDATE_MAJOR = "core_update_major";

@:keep
final CORE_UPDATE_REINSTALL = "core_update_reinstall";

@:keep
final CORE_UPDATE_ROLLBACK = "core_update_rollback";

@:keep
final PLUGIN_ACTION_MISSING_SLUG = "plugin_action_missing_slug";

@:keep
final PLUGIN_ACTION_CAPABILITY_DENIED = "plugin_action_capability_denied";

@:keep
final PLUGIN_ACTION_NONCE_FAILED = "plugin_action_nonce_failed";

@:keep
final PLUGIN_ACTION_FILESYSTEM_CREDENTIALS = "plugin_action_filesystem_credentials";

@:keep
final PLUGIN_ACTION_INSTALL = "plugin_action_install";

@:keep
final PLUGIN_ACTION_UPDATE = "plugin_action_update";

@:keep
final PLUGIN_ACTION_DELETE = "plugin_action_delete";

@:keep
final LANGUAGE_UPDATE_NO_LOCALE = "language_update_no_locale";

@:keep
final LANGUAGE_UPDATE_ALREADY_CURRENT = "language_update_already_current";

@:keep
final LANGUAGE_UPDATE_DOWNLOAD = "language_update_download";

@:keep
final LANGUAGE_UPDATE_ACTIVATE = "language_update_activate";

@:keep
final UPGRADER_SKIN_HEADER = "upgrader_skin_header";

@:keep
final UPGRADER_SKIN_FEEDBACK = "upgrader_skin_feedback";

@:keep
final UPGRADER_SKIN_ERROR = "upgrader_skin_error";

@:keep
final UPGRADER_SKIN_BULK_FOOTER = "upgrader_skin_bulk_footer";

@:keep
final UPGRADER_SKIN_AJAX_RESPONSE = "upgrader_skin_ajax_response";

@:keep
final AUTOMATIC_UPDATE_DISABLED = "automatic_update_disabled";

@:keep
final AUTOMATIC_UPDATE_LOCK_HELD = "automatic_update_lock_held";

@:keep
final AUTOMATIC_UPDATE_FILESYSTEM_DENIED = "automatic_update_filesystem_denied";

@:keep
final AUTOMATIC_UPDATE_CORE_MINOR = "automatic_update_core_minor";

@:keep
final AUTOMATIC_UPDATE_EXTENSION = "automatic_update_extension";

@:keep
final SITE_HEALTH_AUTOMATIC_UPDATES_OK = "site_health_automatic_updates_ok";

@:keep
final SITE_HEALTH_AUTOMATIC_UPDATES_WARNING = "site_health_automatic_updates_warning";

@:keep
final INSTALL_BOOTSTRAP_CONFIG_MISSING = "install_bootstrap_config_missing";

@:keep
final INSTALL_BOOTSTRAP_DB_UNAVAILABLE = "install_bootstrap_db_unavailable";

@:keep
final INSTALL_BOOTSTRAP_ADMIN_REQUIRED = "install_bootstrap_admin_required";

@:keep
final INSTALL_BOOTSTRAP_READY = "install_bootstrap_ready";

@:keep
final NETWORK_UPDATE_NOT_NETWORK_ADMIN = "network_update_not_network_admin";

@:keep
final NETWORK_UPDATE_CAPABILITY_DENIED = "network_update_capability_denied";

@:keep
final NETWORK_UPDATE_CORE = "network_update_core";

@:keep
final NETWORK_UPDATE_PLUGIN = "network_update_plugin";

@:keep
final NETWORK_UPDATE_DASHBOARD = "network_update_dashboard";

@:keep
final RECOVERY_COOKIE_MISSING = "recovery_cookie_missing";

@:keep
final RECOVERY_COOKIE_INVALID = "recovery_cookie_invalid";

@:keep
final RECOVERY_COOKIE_EXPIRED = "recovery_cookie_expired";

@:keep
final RECOVERY_COOKIE_VALID = "recovery_cookie_valid";

@:keep
final RECOVERY_KEY_MISSING = "recovery_key_missing";

@:keep
final RECOVERY_KEY_RATE_LIMITED = "recovery_key_rate_limited";

@:keep
final RECOVERY_KEY_MISMATCH = "recovery_key_mismatch";

@:keep
final RECOVERY_KEY_EXPIRED = "recovery_key_expired";

@:keep
final RECOVERY_KEY_VALID = "recovery_key_valid";

@:keep
final RECOVERY_LINK_EMAIL_UNAVAILABLE = "recovery_link_email_unavailable";

@:keep
final RECOVERY_LINK_TOKEN_STORAGE_FAILED = "recovery_link_token_storage_failed";

@:keep
final RECOVERY_LINK_READY = "recovery_link_ready";

@:keep
final WPHX_319_HANDOFF_AUTH_CAPS_NONCES = "wphx_319_handoff_auth_caps_nonces";

@:keep
final WPHX_319_HANDOFF_HTTP_CRON_MAIL = "wphx_319_handoff_http_cron_mail";

@:keep
final WPHX_319_HANDOFF_FILESYSTEM_MEDIA = "wphx_319_handoff_filesystem_media";

@:keep
final WPHX_319_HANDOFF_ADMIN_UI = "wphx_319_handoff_admin_ui";

@:keep
final WPHX_319_HANDOFF_MULTISITE = "wphx_319_handoff_multisite";

@:keep
final WPHX_319_HANDOFF_THEME_DOMAIN = "wphx_319_handoff_theme_domain";

@:keep
final WPHX_319_HANDOFF_VENDOR_BOUNDARY = "wphx_319_handoff_vendor_boundary";

@:keep
final WPHX_319_HANDOFF_UNKNOWN = "wphx_319_handoff_unknown";

/**
	Chooses update-check intent before HTTP requests, transient persistence,
	package parsing, or cron scheduling execute in public PHP.
**/
@:keep
function updateCheckPlan(updatesDisabled:Bool, hasFreshTransient:Bool, forceCheck:Bool, remoteRequestsAllowed:Bool):String
{
	if (updatesDisabled)
	{
		return UPDATE_CHECK_DISABLED;
	}
	if (hasFreshTransient && !forceCheck)
	{
		return UPDATE_CHECK_TRANSIENT_HIT;
	}
	if (!remoteRequestsAllowed)
	{
		return UPDATE_CHECK_REMOTE_BLOCKED;
	}
	return forceCheck ? UPDATE_CHECK_FORCE_REMOTE : UPDATE_CHECK_REMOTE_ALLOWED;
}

/**
	Classifies core update intent while package download, unpacking, copy, and
	database upgrade behavior stay in WordPress-compatible PHP boundaries.
**/
@:keep
function coreUpdatePlan(updateAvailable:Bool, minorUpdate:Bool, reinstallRequested:Bool, rollbackRequested:Bool):String
{
	if (rollbackRequested)
	{
		return CORE_UPDATE_ROLLBACK;
	}
	if (reinstallRequested)
	{
		return CORE_UPDATE_REINSTALL;
	}
	if (!updateAvailable)
	{
		return CORE_UPDATE_NONE;
	}
	return minorUpdate ? CORE_UPDATE_MINOR : CORE_UPDATE_MAJOR;
}

/**
	Routes plugin install/update/delete action intent before admin nonce,
	filesystem credentials, plugin sandboxing, activation, and package IO run.
**/
@:keep
function pluginActionPlan(action:String, slug:String, canManagePlugins:Bool, nonceValid:Bool, filesystemReady:Bool):String
{
	final normalizedAction = action.trim();
	if (slug.trim() == "")
	{
		return PLUGIN_ACTION_MISSING_SLUG;
	}
	if (!canManagePlugins)
	{
		return PLUGIN_ACTION_CAPABILITY_DENIED;
	}
	if (!nonceValid)
	{
		return PLUGIN_ACTION_NONCE_FAILED;
	}
	if (!filesystemReady)
	{
		return PLUGIN_ACTION_FILESYSTEM_CREDENTIALS;
	}
	if (normalizedAction == "install")
	{
		return PLUGIN_ACTION_INSTALL;
	}
	if (normalizedAction == "delete")
	{
		return PLUGIN_ACTION_DELETE;
	}
	return PLUGIN_ACTION_UPDATE;
}

/**
	Classifies language-pack work while translation API requests, package IO,
	and locale switch behavior remain separate evidence gates.
**/
@:keep
function languagePackPlan(locale:String, updateAvailable:Bool, activateAfterInstall:Bool):String
{
	if (locale.trim() == "")
	{
		return LANGUAGE_UPDATE_NO_LOCALE;
	}
	if (!updateAvailable)
	{
		return LANGUAGE_UPDATE_ALREADY_CURRENT;
	}
	return activateAfterInstall ? LANGUAGE_UPDATE_ACTIVATE : LANGUAGE_UPDATE_DOWNLOAD;
}

/**
	Selects upgrader skin output phase intent without claiming concrete admin
	HTML, Ajax JSON payloads, translations, or output buffering behavior.
**/
@:keep
function upgraderSkinPlan(phase:String, hasError:Bool, bulkMode:Bool, ajaxMode:Bool):String
{
	if (hasError)
	{
		return UPGRADER_SKIN_ERROR;
	}
	if (ajaxMode)
	{
		return UPGRADER_SKIN_AJAX_RESPONSE;
	}
	if (bulkMode && phase == "after")
	{
		return UPGRADER_SKIN_BULK_FOOTER;
	}
	if (phase == "header")
	{
		return UPGRADER_SKIN_HEADER;
	}
	return UPGRADER_SKIN_FEEDBACK;
}

/**
	Models automatic-update and Site Health guard intent while cron, options,
	filesystem, mail, and HTTP behavior remain cross-domain handoffs.
**/
@:keep
function automaticUpdatePlan(enabled:Bool, lockHeld:Bool, filesystemWritable:Bool, coreMinor:Bool, extensionUpdate:Bool):String
{
	if (!enabled)
	{
		return AUTOMATIC_UPDATE_DISABLED;
	}
	if (lockHeld)
	{
		return AUTOMATIC_UPDATE_LOCK_HELD;
	}
	if (!filesystemWritable)
	{
		return AUTOMATIC_UPDATE_FILESYSTEM_DENIED;
	}
	if (coreMinor)
	{
		return AUTOMATIC_UPDATE_CORE_MINOR;
	}
	return extensionUpdate ? AUTOMATIC_UPDATE_EXTENSION : SITE_HEALTH_AUTOMATIC_UPDATES_OK;
}

/**
	Aggregates Site Health automatic-update status before tests call concrete
	filesystem, HTTP, cron, version-control, filter, and constant checks.
**/
@:keep
function siteHealthAutomaticUpdatesPlan(backgroundUpdatesOk:Bool, filesystemWritable:Bool, hasVersionControl:Bool):String
{
	return backgroundUpdatesOk
		&& filesystemWritable
		&& !hasVersionControl ? SITE_HEALTH_AUTOMATIC_UPDATES_OK : SITE_HEALTH_AUTOMATIC_UPDATES_WARNING;
}

/**
	Routes install bootstrap intent before config-file creation, database schema
	installation, admin creation, login cookies, and redirect output execute.
**/
@:keep
function installBootstrapPlan(configExists:Bool, databaseReady:Bool, adminUserCreated:Bool):String
{
	if (!configExists)
	{
		return INSTALL_BOOTSTRAP_CONFIG_MISSING;
	}
	if (!databaseReady)
	{
		return INSTALL_BOOTSTRAP_DB_UNAVAILABLE;
	}
	if (!adminUserCreated)
	{
		return INSTALL_BOOTSTRAP_ADMIN_REQUIRED;
	}
	return INSTALL_BOOTSTRAP_READY;
}

/**
	Classifies network-admin update wrapper intent while multisite state,
	capabilities, and wrapped screen output remain neighboring domains.
**/
@:keep
function networkUpdatePlan(isNetworkAdmin:Bool, canUpdate:Bool, action:String):String
{
	if (!isNetworkAdmin)
	{
		return NETWORK_UPDATE_NOT_NETWORK_ADMIN;
	}
	if (!canUpdate)
	{
		return NETWORK_UPDATE_CAPABILITY_DENIED;
	}
	if (action == "core")
	{
		return NETWORK_UPDATE_CORE;
	}
	if (action == "plugin")
	{
		return NETWORK_UPDATE_PLUGIN;
	}
	return NETWORK_UPDATE_DASHBOARD;
}

/**
	Models recovery-mode cookie validation intent without owning PHP cookie
	serialization, session binding, redirect behavior, or auth integration.
**/
@:keep
function recoveryCookiePlan(hasCookie:Bool, signatureValid:Bool, expired:Bool):String
{
	if (!hasCookie)
	{
		return RECOVERY_COOKIE_MISSING;
	}
	if (!signatureValid)
	{
		return RECOVERY_COOKIE_INVALID;
	}
	return expired ? RECOVERY_COOKIE_EXPIRED : RECOVERY_COOKIE_VALID;
}

/**
	Models recovery key validation before options storage, rate-limit state,
	email dispatch, and login/session behavior execute in PHP.
**/
@:keep
function recoveryKeyPlan(hasKey:Bool, rateLimited:Bool, matchesStoredKey:Bool, expired:Bool):String
{
	if (!hasKey)
	{
		return RECOVERY_KEY_MISSING;
	}
	if (rateLimited)
	{
		return RECOVERY_KEY_RATE_LIMITED;
	}
	if (!matchesStoredKey)
	{
		return RECOVERY_KEY_MISMATCH;
	}
	return expired ? RECOVERY_KEY_EXPIRED : RECOVERY_KEY_VALID;
}

/**
	Classifies recovery-link send readiness while token persistence, mail
	transport, URLs, translations, and user/account lookup remain later gates.
**/
@:keep
function recoveryLinkPlan(hasEmailAddress:Bool, tokenStored:Bool):String
{
	if (!hasEmailAddress)
	{
		return RECOVERY_LINK_EMAIL_UNAVAILABLE;
	}
	return tokenStored ? RECOVERY_LINK_READY : RECOVERY_LINK_TOKEN_STORAGE_FAILED;
}

/**
	Names the neighboring domain that must own a concrete side effect or public
	ABI before WPHX-319 can claim stronger installed behavior.
**/
@:keep
function handoffPlan(surface:String):String
{
	final normalized = surface.toLowerCase();
	if (normalized.contains("nonce")
		|| normalized.contains("capability")
		|| normalized.contains("auth")
		|| normalized.contains("cookie"))
	{
		return WPHX_319_HANDOFF_AUTH_CAPS_NONCES;
	}
	if (normalized.contains("http") || normalized.contains("cron") || normalized.contains("mail"))
	{
		return WPHX_319_HANDOFF_HTTP_CRON_MAIL;
	}
	if (normalized.contains("filesystem") || normalized.contains("upload") || normalized.contains("package"))
	{
		return WPHX_319_HANDOFF_FILESYSTEM_MEDIA;
	}
	if (normalized.contains("admin") || normalized.contains("list-table") || normalized.contains("notice"))
	{
		return WPHX_319_HANDOFF_ADMIN_UI;
	}
	if (normalized.contains("network") || normalized.contains("multisite"))
	{
		return WPHX_319_HANDOFF_MULTISITE;
	}
	if (normalized.contains("theme"))
	{
		return WPHX_319_HANDOFF_THEME_DOMAIN;
	}
	if (normalized.contains("vendor") || normalized.contains("library"))
	{
		return WPHX_319_HANDOFF_VENDOR_BOUNDARY;
	}
	return WPHX_319_HANDOFF_UNKNOWN;
}
