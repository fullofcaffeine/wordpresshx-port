package wphx.fixtures.wp.core;

import wphx.wp.themes.ThemeTemplateAdapterContract;

@:keep
class ThemeTemplateAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("support:enabled", ThemeTemplateAdapterContract.supportPlan("post-thumbnails", true, false, false));
		emit("support:core-default", ThemeTemplateAdapterContract.supportPlan("title-tag", false, true, false));
		emit("support:block-theme", ThemeTemplateAdapterContract.supportPlan("block-templates", false, false, true));
		emit("support:disabled", ThemeTemplateAdapterContract.supportPlan("custom-logo", false, false, false));
		emit("support:unknown", ThemeTemplateAdapterContract.supportPlan("", false, false, false));

		emit("theme-json:user", ThemeTemplateAdapterContract.themeJsonSource(true, true, true, true));
		emit("theme-json:theme", ThemeTemplateAdapterContract.themeJsonSource(false, true, true, true));
		emit("theme-json:supports", ThemeTemplateAdapterContract.themeJsonSource(false, false, true, true));
		emit("theme-json:core", ThemeTemplateAdapterContract.themeJsonSource(false, false, false, true));
		emit("theme-json:empty", ThemeTemplateAdapterContract.themeJsonSource(false, false, false, false));

		emit("template:block", ThemeTemplateAdapterContract.templateHierarchyPlan(true, true, false, false, false, false, false, false, false));
		emit("template:front-page", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, true, true, false, false, false));
		emit("template:home", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, false, true, false, false, false));
		emit("template:single", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, false, false, true, false, false));
		emit("template:page", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, false, false, false, true, false));
		emit("template:archive", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, false, false, false, false, true));
		emit("template:search", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, true, false, false, false, false, false));
		emit("template:404", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, true, false, false, false, false, false, false));
		emit("template:fallback", ThemeTemplateAdapterContract.templateHierarchyPlan(false, false, false, false, false, false, false, false, false));

		emit("customizer:denied", ThemeTemplateAdapterContract.customizerRoute(false, false, false, false));
		emit("customizer:switch", ThemeTemplateAdapterContract.customizerRoute(true, true, false, false));
		emit("customizer:locked", ThemeTemplateAdapterContract.customizerRoute(true, false, true, false));
		emit("customizer:preview", ThemeTemplateAdapterContract.customizerRoute(true, false, false, true));
		emit("customizer:controls", ThemeTemplateAdapterContract.customizerRoute(true, false, false, false));

		emit("nav:block", ThemeTemplateAdapterContract.navMenuRoute(true, true, true, false));
		emit("nav:assigned", ThemeTemplateAdapterContract.navMenuRoute(true, true, false, false));
		emit("nav:fallback", ThemeTemplateAdapterContract.navMenuRoute(true, false, false, true));
		emit("nav:unassigned", ThemeTemplateAdapterContract.navMenuRoute(true, false, false, false));

		emit("widget:invalid", ThemeTemplateAdapterContract.widgetSidebarRoute(false, false, false, false));
		emit("widget:empty", ThemeTemplateAdapterContract.widgetSidebarRoute(true, false, false, false));
		emit("widget:selective-refresh", ThemeTemplateAdapterContract.widgetSidebarRoute(true, true, false, true));
		emit("widget:block-editor", ThemeTemplateAdapterContract.widgetSidebarRoute(true, true, true, false));
		emit("widget:classic", ThemeTemplateAdapterContract.widgetSidebarRoute(true, true, false, false));

		emit("hook:support", ThemeTemplateAdapterContract.hookPlan("add_theme_support", true));
		emit("hook:theme-json", ThemeTemplateAdapterContract.hookPlan("global_styles", true));
		emit("hook:template", ThemeTemplateAdapterContract.hookPlan("block_template", true));
		emit("hook:customizer", ThemeTemplateAdapterContract.hookPlan("changeset", true));
		emit("hook:nav-menu", ThemeTemplateAdapterContract.hookPlan("wp_nav_menu", true));
		emit("hook:widget", ThemeTemplateAdapterContract.hookPlan("sidebar", true));
		emit("hook:failed", ThemeTemplateAdapterContract.hookPlan("sidebar", false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
