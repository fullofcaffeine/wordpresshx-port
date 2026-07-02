package wphx.fixtures.compiler.php.embed;

import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.getOembedEndpointUrl;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedDefaults;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedHandlerAudio;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedHandlerVideo;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedEnsureFormat;

/**
	Compile anchor for original-path embed module function adapters.
**/
class EmbedModuleEntry
{
	static function main():Void
	{
		wpEmbedDefaults("");
		getOembedEndpointUrl("", "json");
		wpOembedEnsureFormat("json");
		wpEmbedHandlerAudio(null, null, "", null);
		wpEmbedHandlerVideo(null, null, "", null);
	}
}
