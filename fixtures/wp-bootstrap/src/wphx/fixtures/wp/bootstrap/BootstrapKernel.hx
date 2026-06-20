package wphx.fixtures.wp.bootstrap;

import haxe.Json;

typedef BootstrapGate =
{
	final id:String;
	final source:String;
	final active:Bool;
	final detail:String;
};

typedef BootstrapPhase =
{
	final id:String;
	final source:String;
	final active:Bool;
};

typedef BootstrapTrace =
{
	final scenario:String;
	final shortinit:Bool;
	final installing:Bool;
	final recovery:Bool;
	final terminal:String;
	final gates:Array<BootstrapGate>;
	final phases:Array<BootstrapPhase>;
};

class BootstrapKernel
{
	public static function traceJson(scenario:String):String
	{
		return Json.stringify(scenarioTrace(scenario));
	}

	public static function scenarioTrace(scenario:String):BootstrapTrace
	{
		final normalized = normalizeScenario(scenario);
		final shortinit = normalized == "shortinit";
		final installing = normalized == "install";
		final recovery = normalized == "recovery";

		return {
			scenario: normalized,
			shortinit: shortinit,
			installing: installing,
			recovery: recovery,
			terminal: shortinit ? "shortinit_return" : "full_bootstrap",
			gates: [
				gate("wp-load:config-discovery", "src/wp-load.php", true, "wp-config.php root/parent/setup discovery"),
				gate("wp-settings:wpinc-defined", "src/wp-settings.php", true, "WPINC is defined before early requires"),
				gate("wp-settings:shortinit", "src/wp-settings.php", shortinit, "SHORTINIT returns before the post-shortinit phase"),
				gate("wp-includes/load:wp_installing", "src/wp-includes/load.php", installing, "WP_INSTALLING seeds wp_installing()"),
				gate("wp-settings:recovery-mode", "src/wp-settings.php", recovery, "recovery mode initializes before active plugins")
			],
			phases: [
				phase("wp-settings:pre-shortinit", "src/wp-settings.php", true),
				phase("wp-settings:post-shortinit", "src/wp-settings.php", !shortinit),
				phase("wp-settings:recovery-window", "src/wp-settings.php", !shortinit && recovery),
				phase("wp-load:setup-config", "src/wp-load.php", false)
			]
		};
	}

	static function normalizeScenario(scenario:String):String
	{
		return switch scenario
		{
			case "shortinit" | "install" | "recovery": scenario;
			default: "normal";
		};
	}

	static function gate(id:String, source:String, active:Bool, detail:String):BootstrapGate
	{
		return {
			id: id,
			source: source,
			active: active,
			detail: detail
		};
	}

	static function phase(id:String, source:String, active:Bool):BootstrapPhase
	{
		return {
			id: id,
			source: source,
			active: active
		};
	}
}
