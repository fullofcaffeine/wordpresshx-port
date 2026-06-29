package wphx.fixtures.wp.core;

import wphx.wp.blocks.BlocksInteractivityAdapterContract.bindingPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.fontAssetPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.hookPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.hookedBlockPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.htmlApiPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.interactivityPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.parserPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.patternPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.renderPlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.styleEnginePlan;
import wphx.wp.blocks.BlocksInteractivityAdapterContract.supportPlan;

/**
	Deterministic executable probe for the WPHX-314 blocks/interactivity adapter
	contract. Each output line is consumed by the runner and compared with a
	stable expectation before any receipt is written.
**/
@:keep
class BlocksInteractivityAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("parser:malformed", parserPlan(false, true, false, false));
		emit("parser:nested", parserPlan(true, false, true, false));
		emit("parser:serialized", parserPlan(true, false, false, false));
		emit("parser:freeform", parserPlan(false, false, false, true));
		emit("parser:empty", parserPlan(false, false, false, false));

		emit("render:unregistered", renderPlan(false, false, false, false, false));
		emit("render:reusable", renderPlan(true, false, false, true, false));
		emit("render:contextual", renderPlan(true, false, false, false, true));
		emit("render:dynamic", renderPlan(true, true, true, false, false));
		emit("render:static", renderPlan(true, false, false, false, false));

		emit("support:full", supportPlan(true, true, true, true));
		emit("support:style", supportPlan(false, true, false, false));
		emit("support:class", supportPlan(false, false, true, false));
		emit("support:layout", supportPlan(true, false, false, false));
		emit("support:none", supportPlan(false, false, false, false));

		emit("binding:source-missing", bindingPlan(false, true, true, false));
		emit("binding:unbound", bindingPlan(true, false, true, false));
		emit("binding:pattern", bindingPlan(true, true, false, true));
		emit("binding:context-missing", bindingPlan(true, true, false, false));
		emit("binding:resolved", bindingPlan(true, true, true, false));

		emit("hooked:none", hookedBlockPlan(false, false, false, false));
		emit("hooked:ignored", hookedBlockPlan(true, true, false, false));
		emit("hooked:first-child", hookedBlockPlan(true, false, true, false));
		emit("hooked:relative", hookedBlockPlan(true, false, false, true));

		emit("pattern:remote", patternPlan(false, false, false, true));
		emit("pattern:theme", patternPlan(false, false, true, false));
		emit("pattern:category", patternPlan(true, true, false, false));
		emit("pattern:unregistered", patternPlan(false, true, false, false));

		emit("style:empty", styleEnginePlan(false, false, false, false));
		emit("style:declarations", styleEnginePlan(true, false, false, false));
		emit("style:selector", styleEnginePlan(true, true, false, false));
		emit("style:merge", styleEnginePlan(true, true, true, true));

		emit("html:unsupported", htmlApiPlan(true, false, false, true));
		emit("html:tag", htmlApiPlan(true, false, false, false));
		emit("html:attribute", htmlApiPlan(true, true, false, false));
		emit("html:text", htmlApiPlan(true, false, true, false));

		emit("interactivity:disabled", interactivityPlan(false, true, true));
		emit("interactivity:store", interactivityPlan(true, false, false));
		emit("interactivity:directives", interactivityPlan(true, true, false));
		emit("interactivity:hydration", interactivityPlan(true, true, true));

		emit("font:none", fontAssetPlan(false, false, false));
		emit("font:collection", fontAssetPlan(true, false, false));
		emit("font:face", fontAssetPlan(true, true, false));
		emit("font:admin", fontAssetPlan(true, true, true));

		emit("hook:render", hookPlan("render_block", true));
		emit("hook:supports", hookPlan("block_wrapper_attributes", true));
		emit("hook:bindings", hookPlan("block_bindings_source_value", true));
		emit("hook:patterns", hookPlan("register_block_pattern", true));
		emit("hook:interactivity", hookPlan("wp_interactivity_state", true));
		emit("hook:failed", hookPlan("render_block", false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
