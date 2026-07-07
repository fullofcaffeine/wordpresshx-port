package wphx.fixtures.wp.core;

import wphx.wp.themes.ThemeHxxMarkupPilot;

/**
	Executable typed-source probe for the WPHX-320.02 theme HXX markup pilot.
**/
@:keep
class ThemeHxxMarkupPilotEntry
{
	static function main():Void
	{
		final hero = ThemeHxxMarkupPilot.renderHeroPattern({
			title: "Build & Ship",
			summary: "Typed theme markup <safe>",
			ctaLabel: "Start & Go",
			ctaHref: "/start?ref=wphx&mode=theme",
			alignWide: true
		});
		final navigation = ThemeHxxMarkupPilot.renderNavigation({
			ariaLabel: "Primary & Footer",
			items: [
				{
					label: "Home",
					href: "/",
					current: true
				},
				{
					label: "Blog & Notes",
					href: "/blog?view=all&sort=new",
					current: false
				}
			]
		});

		emit("hero", hero);
		emit("navigation", navigation);
		emit("combined", hero + navigation);
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + encode(value));
	}

	static function encode(value:String):String
	{
		return value.split("\\").join("\\\\").split("\n").join("\\n");
	}
}
