package wphx.fixtures.wp.core;

import wphx.wp.blocks.BlockWrapperSupportCandidate;

/**
	Executable probe for the WPHX-314.15 block wrapper support candidate.
**/
@:keep
class BlockWrapperSupportCandidateEntry
{
	static function main():Void
	{
		emit("decision:full", BlockWrapperSupportCandidate.supportDecision(true, true, true, true));
		emit("decision:style", BlockWrapperSupportCandidate.supportDecision(false, false, true, false));
		emit("decision:class", BlockWrapperSupportCandidate.supportDecision(false, true, false, false));
		emit("decision:anchor", BlockWrapperSupportCandidate.supportDecision(true, false, false, false));
		emit("decision:none", BlockWrapperSupportCandidate.supportDecision(false, false, false, false));

		emit("class:merged", BlockWrapperSupportCandidate.classAttribute("wp-block-group", "alignwide is-style-card", "is-layout-constrained"));
		emit("class:trim-empty", BlockWrapperSupportCandidate.classAttribute(" wp-block-paragraph ", " ", " is-layout-flow "));

		emit("style:all", BlockWrapperSupportCandidate.styleAttribute("var(--wp--preset--color--primary)", "#ffffff", "40px"));
		emit("style:skip-empty", BlockWrapperSupportCandidate.styleAttribute("", " #000000 ", ""));

		emit("wrapper:full",
			BlockWrapperSupportCandidate.wrapperAttributes("hero", "wp-block-group", "alignwide", "is-layout-constrained",
				"var(--wp--preset--color--primary)", "#ffffff", "40px", "Hero"));
		emit("wrapper:class-only", BlockWrapperSupportCandidate.wrapperAttributes("", "wp-block-paragraph", "lead", "", "", "", "", ""));
		emit("wrapper:none", BlockWrapperSupportCandidate.wrapperAttributes("", "", "", "", "", "", "", ""));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
