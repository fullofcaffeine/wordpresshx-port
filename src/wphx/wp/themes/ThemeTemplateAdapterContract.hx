package wphx.wp.themes;

using StringTools;

@:keep
class ThemeTemplateAdapterContract
{
	public static inline final SUPPORT_ENABLED = "theme_support_enabled";
	public static inline final SUPPORT_DISABLED = "theme_support_disabled";
	public static inline final SUPPORT_CORE_DEFAULT = "theme_support_core_default";
	public static inline final SUPPORT_BLOCK_THEME = "theme_support_block_theme";
	public static inline final SUPPORT_UNKNOWN = "theme_support_unknown";

	public static inline final THEME_JSON_USER = "theme_json_user";
	public static inline final THEME_JSON_THEME = "theme_json_theme";
	public static inline final THEME_JSON_CORE = "theme_json_core";
	public static inline final THEME_JSON_SUPPORTS = "theme_json_theme_supports";
	public static inline final THEME_JSON_EMPTY = "theme_json_empty";

	public static inline final TEMPLATE_BLOCK = "template_block_theme";
	public static inline final TEMPLATE_FRONT_PAGE = "template_front_page";
	public static inline final TEMPLATE_HOME = "template_home";
	public static inline final TEMPLATE_SINGLE = "template_single";
	public static inline final TEMPLATE_PAGE = "template_page";
	public static inline final TEMPLATE_ARCHIVE = "template_archive";
	public static inline final TEMPLATE_SEARCH = "template_search";
	public static inline final TEMPLATE_404 = "template_404";
	public static inline final TEMPLATE_CLASSIC_FALLBACK = "template_classic_fallback";

	public static inline final CUSTOMIZER_DENIED = "customizer_denied";
	public static inline final CUSTOMIZER_THEME_SWITCH = "customizer_theme_switch";
	public static inline final CUSTOMIZER_CHANGESET_LOCKED = "customizer_changeset_locked";
	public static inline final CUSTOMIZER_PREVIEW = "customizer_preview";
	public static inline final CUSTOMIZER_CONTROLS = "customizer_controls";

	public static inline final NAV_BLOCK = "nav_menu_block";
	public static inline final NAV_ASSIGNED_LOCATION = "nav_menu_assigned_location";
	public static inline final NAV_FALLBACK_PAGES = "nav_menu_fallback_pages";
	public static inline final NAV_UNASSIGNED = "nav_menu_unassigned";

	public static inline final WIDGET_BLOCK_EDITOR = "widget_block_editor";
	public static inline final WIDGET_CLASSIC = "widget_classic";
	public static inline final WIDGET_SELECTIVE_REFRESH = "widget_selective_refresh";
	public static inline final WIDGET_EMPTY_SIDEBAR = "widget_empty_sidebar";
	public static inline final WIDGET_INVALID_SIDEBAR = "widget_invalid_sidebar";

	public static inline final HOOK_NONE = "theme_template_no_hooks";
	public static inline final HOOK_THEME_SUPPORT = "theme_support_hooks";
	public static inline final HOOK_THEME_JSON = "theme_json_hooks";
	public static inline final HOOK_TEMPLATE = "template_hierarchy_hooks";
	public static inline final HOOK_CUSTOMIZER = "customizer_hooks";
	public static inline final HOOK_NAV_MENU = "nav_menu_hooks";
	public static inline final HOOK_WIDGET = "widget_sidebar_hooks";

	public static function supportPlan(feature:String, themeDeclaresSupport:Bool, coreDefaultSupport:Bool, blockTheme:Bool):String
	{
		final normalized = feature.trim().toLowerCase();
		if (normalized == "")
		{
			return SUPPORT_UNKNOWN;
		}
		if (blockTheme && (normalized == "block-templates" || normalized == "editor-styles" || normalized == "wp-block-styles"))
		{
			return SUPPORT_BLOCK_THEME;
		}
		if (themeDeclaresSupport)
		{
			return SUPPORT_ENABLED;
		}
		if (coreDefaultSupport)
		{
			return SUPPORT_CORE_DEFAULT;
		}
		return SUPPORT_DISABLED;
	}

	public static function themeJsonSource(hasUserData:Bool, hasThemeJson:Bool, hasThemeSupportData:Bool, hasCoreData:Bool):String
	{
		if (hasUserData)
		{
			return THEME_JSON_USER;
		}
		if (hasThemeJson)
		{
			return THEME_JSON_THEME;
		}
		if (hasThemeSupportData)
		{
			return THEME_JSON_SUPPORTS;
		}
		return hasCoreData ? THEME_JSON_CORE : THEME_JSON_EMPTY;
	}

	public static function templateHierarchyPlan(blockTheme:Bool, hasBlockTemplate:Bool, is404:Bool, isSearch:Bool, isFrontPage:Bool, isHome:Bool,
			isSingle:Bool, isPage:Bool, isArchive:Bool):String
	{
		if (blockTheme && hasBlockTemplate)
		{
			return TEMPLATE_BLOCK;
		}
		if (is404)
		{
			return TEMPLATE_404;
		}
		if (isSearch)
		{
			return TEMPLATE_SEARCH;
		}
		if (isFrontPage)
		{
			return TEMPLATE_FRONT_PAGE;
		}
		if (isHome)
		{
			return TEMPLATE_HOME;
		}
		if (isSingle)
		{
			return TEMPLATE_SINGLE;
		}
		if (isPage)
		{
			return TEMPLATE_PAGE;
		}
		return isArchive ? TEMPLATE_ARCHIVE : TEMPLATE_CLASSIC_FALLBACK;
	}

	public static function customizerRoute(userCanCustomize:Bool, themeSwitchRequested:Bool, changesetLocked:Bool, previewRequested:Bool):String
	{
		if (!userCanCustomize)
		{
			return CUSTOMIZER_DENIED;
		}
		if (themeSwitchRequested)
		{
			return CUSTOMIZER_THEME_SWITCH;
		}
		if (changesetLocked)
		{
			return CUSTOMIZER_CHANGESET_LOCKED;
		}
		return previewRequested ? CUSTOMIZER_PREVIEW : CUSTOMIZER_CONTROLS;
	}

	public static function navMenuRoute(locationRegistered:Bool, menuAssigned:Bool, blockTheme:Bool, fallbackAllowed:Bool):String
	{
		if (blockTheme)
		{
			return NAV_BLOCK;
		}
		if (locationRegistered && menuAssigned)
		{
			return NAV_ASSIGNED_LOCATION;
		}
		return fallbackAllowed ? NAV_FALLBACK_PAGES : NAV_UNASSIGNED;
	}

	public static function widgetSidebarRoute(sidebarRegistered:Bool, hasWidgets:Bool, blockWidgetEditor:Bool, selectiveRefresh:Bool):String
	{
		if (!sidebarRegistered)
		{
			return WIDGET_INVALID_SIDEBAR;
		}
		if (!hasWidgets)
		{
			return WIDGET_EMPTY_SIDEBAR;
		}
		if (selectiveRefresh)
		{
			return WIDGET_SELECTIVE_REFRESH;
		}
		return blockWidgetEditor ? WIDGET_BLOCK_EDITOR : WIDGET_CLASSIC;
	}

	public static function hookPlan(operation:String, succeeded:Bool):String
	{
		if (!succeeded)
		{
			return HOOK_NONE;
		}
		return switch operation.trim().toLowerCase()
		{
			case "add_theme_support" | "remove_theme_support":
				HOOK_THEME_SUPPORT;
			case "theme_json" | "global_styles":
				HOOK_THEME_JSON;
			case "template" | "block_template" | "template_hierarchy":
				HOOK_TEMPLATE;
			case "customize" | "customizer" | "changeset":
				HOOK_CUSTOMIZER;
			case "nav_menu" | "wp_nav_menu":
				HOOK_NAV_MENU;
			case "widget" | "sidebar":
				HOOK_WIDGET;
			case _:
				HOOK_NONE;
		}
	}
}
