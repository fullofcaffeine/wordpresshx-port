package wphx.wp.ai;

import wphx.wp.ai.AiClientWrapperSurface.wpAiClientPrompt;
import wphx.wp.ai.AiClientWrapperSurface.wpSupportsAi;

/**
	Compile anchor for the original-path WordPress AI client wrapper adapter.
**/
class AiClientWrapperEntry
{
	static function main():Void
	{
		wpSupportsAi();
		wpAiClientPrompt(null);
	}
}
