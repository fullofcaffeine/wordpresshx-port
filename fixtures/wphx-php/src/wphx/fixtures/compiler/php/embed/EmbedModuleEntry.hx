package wphx.fixtures.compiler.php.embed;

import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.getOembedEndpointUrl;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.enqueueEmbedScripts;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.oembedCreateXml;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.theExcerptEmbed;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.theEmbedSiteTitle;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedDefaults;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedExcerptAttachment;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedExcerptMore;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedHandlerAudio;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedHandlerVideo;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedHandlerYoutube;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedRegisterHandler;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpEmbedUnregisterHandler;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpFilterPreOembedResult;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpMaybeEnqueueOembedHostJs;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpMaybeLoadEmbeds;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedAddDiscoveryLinks;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedAddProvider;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedAddHostJs;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedEnsureFormat;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedGet;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedGetObject;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedRegisterRoute;
import wphx.fixtures.compiler.php.embed.EmbedModuleSurface.wpOembedRemoveProvider;

/**
	Compile anchor for original-path embed module function adapters.
**/
class EmbedModuleEntry
{
	static function main():Void
	{
		wpEmbedRegisterHandler("", "", null, 10);
		wpEmbedUnregisterHandler("", 10);
		wpEmbedDefaults("");
		wpOembedGet("", "");
		wpOembedGetObject();
		getOembedEndpointUrl("", "json");
		wpOembedEnsureFormat("json");
		oembedCreateXml(null, null);
		wpOembedAddProvider("", "", false);
		wpOembedRemoveProvider("");
		wpOembedRegisterRoute();
		wpOembedAddDiscoveryLinks();
		wpOembedAddHostJs();
		wpMaybeEnqueueOembedHostJs("");
		wpEmbedExcerptMore("");
		theExcerptEmbed();
		wpEmbedExcerptAttachment("");
		enqueueEmbedScripts();
		theEmbedSiteTitle();
		wpFilterPreOembedResult(null, "", null);
		wpMaybeLoadEmbeds();
		wpEmbedHandlerYoutube(null, null, "", null);
		wpEmbedHandlerAudio(null, null, "", null);
		wpEmbedHandlerVideo(null, null, "", null);
	}
}
