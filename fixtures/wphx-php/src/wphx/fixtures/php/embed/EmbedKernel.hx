package wphx.fixtures.php.embed;

import php.SuperGlobal;
import wphx.wp.boundary.NativeArray as WpNativeArray;
import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Selected embed.php helper behavior owned by Haxe behind original-path PHP functions.
**/
@:keep
class EmbedKernel
{
	static var wpOembed:Null<WpOembed> = null;

	public static function embedRegisterHandler(id:String, regex:String, callback:NativeValue, priority:Int):Void
	{
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		wpEmbed.registerHandler(id, regex, callback, priority);
	}

	public static function embedUnregisterHandler(id:String, priority:Int):Void
	{
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		wpEmbed.unregisterHandler(id, priority);
	}

	public static function embedDefaults(url:String):php.NativeArray
	{
		var width = 0;
		final contentWidth = WpNativeArray.get(SuperGlobal.GLOBALS, "content_width", null);
		if (EmbedGlobals.truthy(contentWidth))
		{
			width = EmbedGlobals.intval(contentWidth);
		}

		if (width == 0)
		{
			width = 500;
		}

		final height = Std.int(Math.min(Math.ceil(width * 1.5), 1000));
		return EmbedHooks.applyFiltersNative2("embed_defaults", embedSize(width, height), url);
	}

	public static function oembedGet(url:String, args:NativeValue):NativeValue
	{
		final oembed = oembedGetObject();
		// WPHX-211: wp_oembed_get() forwards WordPress's raw array|string args to WP_oEmbed.
		return oembed.getHtml(url, args);
	}

	public static function oembedGetObject():WpOembed
	{
		if (wpOembed == null)
		{
			// WPHX-211: this preserves WordPress's native WP_oEmbed singleton object boundary.
			wpOembed = new WpOembed();
		}

		return wpOembed;
	}

	public static function oembedEndpointUrl(permalink:String, format:String):String
	{
		var url = EmbedGlobals.restUrl("oembed/1.0/embed");
		if (permalink != "")
		{
			url = EmbedGlobals.addQueryArg(queryArgs(permalink, format), url);
		}

		return EmbedHooks.applyFiltersString3("oembed_endpoint_url", url, permalink, format);
	}

	public static function oembedEnsureFormat(format:String):String
	{
		return format == "xml" || format == "json" ? format : "json";
	}

	public static function postEmbedUrl(post:NativeValue = null):NativeValue
	{
		final resolvedPost = EmbedGlobals.getPost(post);
		if (!EmbedGlobals.truthy(resolvedPost))
		{
			return false;
		}

		var embedUrl = EmbedGlobals.trailingslashit(EmbedGlobals.getPermalinkForPost(resolvedPost)) + EmbedGlobals.userTrailingslashit("embed");
		final path = EmbedGlobals.strReplace(EmbedGlobals.homeUrl(), "", embedUrl);
		final pathConflict = EmbedGlobals.getPageByPath(path, "OBJECT", EmbedGlobals.getPostTypes(publicPostTypesQuery()));
		if (!EmbedGlobals.truthy(EmbedGlobals.getOption("permalink_structure")) || EmbedGlobals.truthy(pathConflict))
		{
			embedUrl = EmbedGlobals.addQueryArg(embedQueryArgs(), EmbedGlobals.getPermalinkForPost(resolvedPost));
		}

		return EmbedGlobals.sanitizeUrl(EmbedHooks.applyFiltersNative2("post_embed_url", embedUrl, resolvedPost));
	}

	public static function oembedCreateXml(data:NativeValue, node:NativeValue = null):NativeValue
	{
		if (!WpNativeArray.isArray(data))
		{
			return false;
		}

		// WPHX-211: _oembed_create_xml() accepts arbitrary native PHP arrays at the public ABI.
		final dataArray:php.NativeArray = cast data;
		if (WpNativeArray.count(dataArray) == 0)
		{
			return false;
		}

		final xmlNode = node == null ? new SimpleXmlElement("<oembed></oembed>") : existingSimpleXmlNode(node);
		for (pair in dataArray.keyValueIterator())
		{
			final key = EmbedGlobals.isNumeric(pair.key) ? "oembed" : EmbedGlobals.strval(pair.key);
			if (WpNativeArray.isArray(pair.value))
			{
				// WPHX-211: recursive oEmbed XML creation must preserve native PHP array key/value traversal.
				final child = xmlNode.addChild(key);
				oembedCreateXml(pair.value, child);
			} else
			{
				xmlNode.addChild(key, EmbedGlobals.escHtml(EmbedGlobals.strval(pair.value)));
			}
		}

		return xmlNode.asXml();
	}

	public static function oembedAddProvider(format:String, provider:String, regex:Bool):Void
	{
		if (EmbedGlobals.didAction("plugins_loaded") > 0)
		{
			final oembed = oembedGetObject();
			// WPHX-211: WP_oEmbed providers is a public native PHP associative array.
			EmbedGlobals.arraySet(oembed.providers, format, providerPair(provider, regex));
		} else
		{
			WpOembed.addProviderEarly(format, provider, regex);
		}
	}

	public static function oembedRemoveProvider(format:String):Bool
	{
		if (EmbedGlobals.didAction("plugins_loaded") > 0)
		{
			final oembed = oembedGetObject();
			if (WpNativeArray.issetKey(oembed.providers, format))
			{
				// WPHX-211: provider removal mutates WP_oEmbed's native public providers array.
				EmbedGlobals.arrayUnset(oembed.providers, format);
				return true;
			}
		} else
		{
			WpOembed.removeProviderEarly(format);
		}

		return false;
	}

	public static function oembedRegisterRoute():Void
	{
		final controller = new WpOembedController();
		controller.registerRoutes();
	}

	public static function oembedDiscoveryLinks():String
	{
		if (EmbedGlobals.doingAction("wp_head") > 0)
		{
			if (!EmbedGlobals.truthy(EmbedGlobals.hasActionPriority("wp_head", "wp_oembed_add_discovery_links", 10)))
			{
				return "";
			}

			EmbedGlobals.removeAction("wp_head", "wp_oembed_add_discovery_links");
		}

		var output = "";
		if (EmbedGlobals.isSingular() && EmbedGlobals.isPostEmbeddable())
		{
			output += "<link rel=\"alternate\" title=\""
				+ EmbedGlobals.translateWithContext("oEmbed (JSON)", "oEmbed resource link name")
				+ "\" type=\"application/json+oembed\" href=\""
				+ EmbedGlobals.escUrl(oembedEndpointUrl(EmbedGlobals.getPermalink(), "json"))
				+ "\" />\n";

			if (EmbedGlobals.classExists("SimpleXMLElement"))
			{
				output += "<link rel=\"alternate\" title=\""
					+ EmbedGlobals.translateWithContext("oEmbed (XML)", "oEmbed resource link name")
					+ "\" type=\"text/xml+oembed\" href=\""
					+ EmbedGlobals.escUrl(oembedEndpointUrl(EmbedGlobals.getPermalink(), "xml"))
					+ "\" />\n";
			}
		}

		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative1("oembed_discovery_links", output));
	}

	public static function oembedAddHostJs():Void {}

	public static function maybeEnqueueOembedHostJs(html:String):String
	{
		if (EmbedGlobals.truthy(EmbedGlobals.hasAction("wp_head", "wp_oembed_add_host_js"))
			&& EmbedGlobals.pregMatch("/<blockquote\\s[^>]*?wp-embedded-content/", html) > 0)
		{
			EmbedGlobals.wpEnqueueScript("wp-embed");
		}

		return html;
	}

	public static function embedExcerptMore(moreString:String):String
	{
		if (!EmbedGlobals.isEmbed())
		{
			return moreString;
		}

		final screenReaderTitle = "<span class=\"screen-reader-text\">" + EmbedGlobals.getTheTitle() + "</span>";
		final continueText = EmbedGlobals.sprintfOne(EmbedGlobals.translate("Continue reading %s"), screenReaderTitle);
		final link = "<a href=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.getPermalink())
			+ "\" class=\"wp-embed-more\" target=\"_top\">"
			+ continueText
			+ "</a>";
		return " &hellip; " + link;
	}

	public static function excerptEmbed():String
	{
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative1("the_excerpt_embed", EmbedGlobals.getTheExcerpt()));
	}

	public static function embedExcerptAttachment(content:String):String
	{
		return EmbedGlobals.isAttachment() ? EmbedGlobals.prependAttachment("") : content;
	}

	public static function enqueueEmbedScripts():Void
	{
		EmbedGlobals.doAction("enqueue_embed_scripts");
	}

	public static function enqueueEmbedStyles():Void
	{
		if (!EmbedGlobals.truthy(EmbedGlobals.hasAction("embed_head", "print_embed_styles")))
		{
			return;
		}

		EmbedGlobals.removeAction("embed_head", "print_embed_styles");

		final suffix = EmbedGlobals.wpScriptsGetSuffix();
		final handle = "wp-embed-template";
		EmbedGlobals.wpRegisterStyle(handle, false);
		EmbedGlobals.wpAddInlineStyle(handle, EmbedGlobals.fileGetContents(wpIncludesPath("/css/wp-embed-template" + suffix + ".css")));
		EmbedGlobals.wpEnqueueStyle(handle);
	}

	public static function printEmbedScripts():Void
	{
		final jsPath = "/js/wp-embed-template" + EmbedGlobals.wpScriptsGetSuffix() + ".js";
		EmbedGlobals.wpPrintInlineScriptTag(EmbedGlobals.trim(EmbedGlobals.fileGetContents(wpIncludesPath(jsPath)))
			+ "\n//# sourceURL="
			+ EmbedGlobals.escUrlRaw(EmbedGlobals.includesUrl(jsPath)));
	}

	public static function embedSiteTitle():String
	{
		final siteTitle = "<div class=\"wp-embed-site-title\"><a href=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.homeUrl())
			+ "\" target=\"_top\"><img src=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.getSiteIconUrl(32, EmbedGlobals.includesUrl("images/w-logo-blue.png")))
			+ "\" srcset=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.getSiteIconUrl(64, EmbedGlobals.includesUrl("images/w-logo-blue.png")))
			+ " 2x\" width=\"32\" height=\"32\" alt=\"\" class=\"wp-embed-site-icon\" /><span>"
			+ EmbedGlobals.escHtml(EmbedGlobals.getBloginfo("name"))
			+ "</span></a></div>";
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative1("embed_site_title_html", siteTitle));
	}

	public static function filterPreOembedResult(result:NativeValue, url:String, args:NativeValue):NativeValue
	{
		final data = EmbedGlobals.getOembedResponseDataForUrl(url, args);
		if (EmbedGlobals.truthy(data))
		{
			return oembedGetObject().dataToHtml(data, url);
		}

		return result;
	}

	public static function oembedFilterFeedContent(content:String):String
	{
		final processor = new WpHtmlTagProcessor(content);
		while (processor.nextTag(tagNameQuery("iframe")))
		{
			if (processor.hasClass("wp-embedded-content"))
			{
				processor.removeAttribute("style");
			}
		}

		return processor.getUpdatedHtml();
	}

	public static function filterOembedIframeTitleAttribute(result:NativeValue, data:NativeValue, url:String):NativeValue
	{
		if (strictFalse(result))
		{
			return result;
		}

		final dataType = objectFieldString(data, "type");
		if (dataType != "rich" && dataType != "video")
		{
			return result;
		}

		final resultString = EmbedGlobals.strval(result);
		var title = objectFieldTruthy(data, "title") ? objectFieldString(data, "title") : "";
		var iframeTag = "";
		var attrs:php.NativeArray = null;

		final matches = EmbedGlobals.pregMatchCapture("`<iframe([^>]*)>`i", resultString);
		if (WpNativeArray.count(matches) > 0)
		{
			iframeTag = EmbedGlobals.strval(WpNativeArray.get(matches, 0, ""));
			attrs = EmbedGlobals.wpKsesHair(EmbedGlobals.strval(WpNativeArray.get(matches, 1, "")), EmbedGlobals.wpAllowedProtocols());
			final attrKeys = WpNativeArray.keys(attrs);
			for (attrKey in attrKeys)
			{
				final attr = EmbedGlobals.strval(attrKey);
				final lowerAttr = EmbedGlobals.strtolower(attr);
				if (lowerAttr != attr && !WpNativeArray.issetKey(attrs, lowerAttr))
				{
					// WPHX-211: wp_kses_hair() returns native attribute records keyed by original PHP attribute name.
					EmbedGlobals.arraySet(attrs, lowerAttr, WpNativeArray.get(attrs, attr, null));
					EmbedGlobals.arrayUnset(attrs, attr);
				}
			}
		}

		if (attrs != null && WpNativeArray.issetKey(attrs, "title"))
		{
			// WPHX-211: wp_kses_hair() stores each parsed attribute as a native PHP array record.
			final titleAttr:php.NativeArray = cast WpNativeArray.get(attrs, "title", null);
			final titleValue = WpNativeArray.get(titleAttr, "value", "");
			if (EmbedGlobals.truthy(titleValue))
			{
				title = EmbedGlobals.strval(titleValue);
			}
		}

		title = EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("oembed_iframe_title_attribute", title, result, data, url));
		if (title == "")
		{
			return result;
		}

		var rewrittenResult = resultString;
		if (attrs != null && WpNativeArray.issetKey(attrs, "title"))
		{
			EmbedGlobals.arrayUnset(attrs, "title");
			final attrString = EmbedGlobals.implode(" ", EmbedGlobals.wpListPluck(attrs, "whole"));
			rewrittenResult = EmbedGlobals.strReplace(iframeTag, "<iframe " + EmbedGlobals.trim(attrString) + ">", rewrittenResult);
		}

		return EmbedGlobals.strIreplace("<iframe ", EmbedGlobals.sprintfOne("<iframe title=\"%s\" ", EmbedGlobals.escAttr(title)), rewrittenResult);
	}

	public static function printEmbedSharingButton():String
	{
		if (EmbedGlobals.is404())
		{
			return "";
		}

		return "\t<div class=\"wp-embed-share\">\n\t\t<button type=\"button\" class=\"wp-embed-share-dialog-open\" aria-label=\""
			+ EmbedGlobals.escAttr(EmbedGlobals.translate("Open sharing dialog"))
			+ "\">\n\t\t\t<span class=\"dashicons dashicons-share\"></span>\n\t\t</button>\n\t</div>\n\t";
	}

	public static function printEmbedCommentsButton():String
	{
		final commentsNumber = EmbedGlobals.getCommentsNumber();
		if (EmbedGlobals.is404() || !(commentsNumber != 0 || EmbedGlobals.commentsOpen()))
		{
			return "";
		}

		final commentText = EmbedGlobals.sprintfOne(EmbedGlobals.translatePlural("%s <span class=\"screen-reader-text\">Comment</span>",
			"%s <span class=\"screen-reader-text\">Comments</span>", commentsNumber),
			EmbedGlobals.numberFormatI18n(commentsNumber));
		return "\t<div class=\"wp-embed-comments\">\n\t\t<a href=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.getCommentsLink())
			+ "\" target=\"_top\">\n\t\t\t<span class=\"dashicons dashicons-admin-comments\"></span>\n\t\t\t"
			+ commentText
			+ "\t\t</a>\n\t</div>\n\t";
	}

	public static function maybeLoadEmbeds():Void
	{
		if (!EmbedGlobals.truthy(EmbedHooks.applyFiltersNative1("load_default_embeds", true)))
		{
			return;
		}

		embedRegisterHandler("youtube_embed_url", "#https?://(www\\.)?youtube\\.com/(?:v|embed)/([^/]+)#i", "wp_embed_handler_youtube", 10);
		embedRegisterHandler("audio", "#^https?://.+?\\.(" + EmbedGlobals.implode("|", EmbedGlobals.wpGetAudioExtensions()) + ")$#i",
			EmbedHooks.applyFiltersNative1("wp_audio_embed_handler", "wp_embed_handler_audio"), 9999);
		embedRegisterHandler("video", "#^https?://.+?\\.(" + EmbedGlobals.implode("|", EmbedGlobals.wpGetVideoExtensions()) + ")$#i",
			EmbedHooks.applyFiltersNative1("wp_video_embed_handler", "wp_embed_handler_video"), 9999);
	}

	public static function embedHandlerYoutube(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		// WPHX-211: regex matches arrive as a native PHP array at the public handler boundary.
		final matchesArray:php.NativeArray = cast matches;
		final videoId = EmbedGlobals.urlencode(EmbedGlobals.strval(WpNativeArray.get(matchesArray, 2, "")));
		// WPHX-211: WordPress stores the process-global WP_Embed instance in $GLOBALS['wp_embed'].
		final wpEmbed:WpEmbed = cast WpNativeArray.get(SuperGlobal.GLOBALS, "wp_embed", null);
		final embed = wpEmbed.autoembed(EmbedGlobals.sprintfOne("https://youtube.com/watch?v=%s", videoId));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_youtube", embed, attr, url, rawAttr));
	}

	public static function embedHandlerAudio(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		final audio = EmbedGlobals.sprintfOne("[audio src=\"%s\" /]", EmbedGlobals.escUrl(url));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_audio", audio, attr, url, rawAttr));
	}

	public static function embedHandlerVideo(matches:NativeValue, attr:NativeValue, url:String, rawAttr:NativeValue):String
	{
		var dimensions = "";
		// WPHX-211: raw shortcode attributes arrive as a native PHP array at the public handler boundary.
		final rawAttrArray:php.NativeArray = cast rawAttr;
		final width = WpNativeArray.get(rawAttrArray, "width", null);
		final height = WpNativeArray.get(rawAttrArray, "height", null);
		if (EmbedGlobals.truthy(width) && EmbedGlobals.truthy(height))
		{
			dimensions += EmbedGlobals.sprintfInt("width=\"%d\" ", EmbedGlobals.intval(width));
			dimensions += EmbedGlobals.sprintfInt("height=\"%d\" ", EmbedGlobals.intval(height));
		}

		final video = EmbedGlobals.sprintfTwo("[video %s src=\"%s\" /]", dimensions, EmbedGlobals.escUrl(url));
		return EmbedGlobals.strval(EmbedHooks.applyFiltersNative4("wp_embed_handler_video", video, attr, url, rawAttr));
	}

	static function embedSize(width:Int, height:Int):php.NativeArray
	{
		// WPHX-211: wp_embed_defaults() returns a native PHP compact('width', 'height') array.
		return php.Syntax.code("array('width' => {0}, 'height' => {1})", width, height);
	}

	static function queryArgs(permalink:String, format:String):php.NativeArray
	{
		// WPHX-211: add_query_arg() consumes a native PHP array with false-valued entries preserved/skipped by PHP.
		return php.Syntax.code("array('url' => urlencode({0}), 'format' => ('json' !== {1}) ? {1} : false)", permalink, format);
	}

	static function publicPostTypesQuery():php.NativeArray
	{
		// WPHX-211: get_post_types() consumes a native associative args array.
		return php.Syntax.code("array('public' => true)");
	}

	static function embedQueryArgs():php.NativeArray
	{
		// WPHX-211: get_post_embed_url() falls back to native add_query_arg() array semantics.
		return php.Syntax.code("array('embed' => 'true')");
	}

	static function providerPair(provider:String, regex:Bool):php.NativeArray
	{
		// WPHX-211: WordPress stores oEmbed provider tuples as native indexed arrays.
		return php.Syntax.code("array({0}, {1})", provider, regex);
	}

	static function tagNameQuery(tagName:String):php.NativeArray
	{
		// WPHX-211: WP_HTML_Tag_Processor::next_tag() consumes a native query array.
		return php.Syntax.code("array('tag_name' => {0})", tagName);
	}

	static function wpIncludesPath(path:String):String
	{
		// WPHX-211: WordPress asset paths are assembled from the native ABSPATH and WPINC constants.
		return php.Syntax.code("ABSPATH . WPINC . {0}", path);
	}

	static function existingSimpleXmlNode(node:NativeValue):SimpleXmlElement
	{
		// WPHX-211: recursive _oembed_create_xml() receives a PHP SimpleXMLElement child object.
		return cast node;
	}

	static function strictFalse(value:NativeValue):Bool
	{
		// WPHX-211: this filter must preserve WordPress's strict false return contract.
		return php.Syntax.code("{0} === false", value);
	}

	static function objectFieldString(value:NativeValue, field:String):String
	{
		return EmbedGlobals.strval(EmbedGlobals.objectField(value, field));
	}

	static function objectFieldTruthy(value:NativeValue, field:String):Bool
	{
		return EmbedGlobals.truthy(EmbedGlobals.objectField(value, field));
	}
}

/**
	Narrow externs for WordPress embed helper calls preserved at the PHP boundary.
**/
@:phpGlobal
extern class EmbedGlobals
{
	@:native("rest_url")
	public static function restUrl(path:String):String;

	@:native("add_query_arg")
	public static function addQueryArg(args:php.NativeArray, url:String):String;

	@:native("get_post")
	public static function getPost(post:NativeValue):NativeValue;

	@:native("get_permalink")
	public static function getPermalinkForPost(post:NativeValue):String;

	@:native("esc_url")
	public static function escUrl(url:String):String;

	@:native("esc_url_raw")
	public static function escUrlRaw(url:String):String;

	@:native("sanitize_url")
	public static function sanitizeUrl(url:NativeValue):NativeValue;

	@:native("trailingslashit")
	public static function trailingslashit(url:String):String;

	@:native("user_trailingslashit")
	public static function userTrailingslashit(path:String):String;

	@:native("get_page_by_path")
	public static function getPageByPath(path:String, output:String, postTypes:php.NativeArray):NativeValue;

	@:native("get_post_types")
	public static function getPostTypes(args:php.NativeArray):php.NativeArray;

	@:native("get_option")
	public static function getOption(name:String):NativeValue;

	@:native("str_replace")
	public static function strReplace(search:String, replace:String, subject:String):String;

	@:native("str_ireplace")
	public static function strIreplace(search:String, replace:String, subject:String):String;

	@:native("strtolower")
	public static function strtolower(value:String):String;

	@:native("esc_html")
	public static function escHtml(value:String):String;

	@:native("esc_attr")
	public static function escAttr(value:String):String;

	@:native("home_url")
	public static function homeUrl():String;

	@:native("get_site_icon_url")
	public static function getSiteIconUrl(size:Int, fallback:String):String;

	@:native("includes_url")
	public static function includesUrl(path:String):String;

	@:native("get_bloginfo")
	public static function getBloginfo(show:String):String;

	@:native("urlencode")
	public static function urlencode(value:String):String;

	@:native("sprintf")
	public static function sprintfOne(format:String, arg:String):String;

	@:native("sprintf")
	public static function sprintfTwo(format:String, arg1:String, arg2:String):String;

	@:native("sprintf")
	public static function sprintfInt(format:String, arg:Int):String;

	@:native("strval")
	public static function strval(value:NativeValue):String;

	@:native("intval")
	public static function intval(value:NativeValue):Int;

	@:native("is_numeric")
	public static function isNumeric(value:NativeValue):Bool;

	@:native("implode")
	public static function implode(separator:String, pieces:php.NativeArray):String;

	@:native("wp_get_audio_extensions")
	public static function wpGetAudioExtensions():php.NativeArray;

	@:native("wp_get_video_extensions")
	public static function wpGetVideoExtensions():php.NativeArray;

	@:native("did_action")
	public static function didAction(hookName:String):Int;

	@:native("do_action")
	public static function doAction(hookName:String):Void;

	@:native("doing_action")
	public static function doingAction(hookName:String):Int;

	@:native("has_action")
	public static function hasAction(hookName:String, callback:String):NativeValue;

	@:native("has_action")
	public static function hasActionPriority(hookName:String, callback:String, priority:Int):NativeValue;

	@:native("remove_action")
	public static function removeAction(hookName:String, callback:String):Void;

	@:native("is_singular")
	public static function isSingular():Bool;

	@:native("is_post_embeddable")
	public static function isPostEmbeddable():Bool;

	@:native("_x")
	public static function translateWithContext(text:String, context:String):String;

	@:native("get_permalink")
	public static function getPermalink():String;

	@:native("get_the_title")
	public static function getTheTitle():String;

	@:native("__")
	public static function translate(text:String):String;

	@:native("_n")
	public static function translatePlural(singular:String, plural:String, number:Int):String;

	@:native("number_format_i18n")
	public static function numberFormatI18n(number:Int):String;

	@:native("get_the_excerpt")
	public static function getTheExcerpt():String;

	@:native("is_embed")
	public static function isEmbed():Bool;

	@:native("is_attachment")
	public static function isAttachment():Bool;

	@:native("is_404")
	public static function is404():Bool;

	@:native("get_comments_number")
	public static function getCommentsNumber():Int;

	@:native("comments_open")
	public static function commentsOpen():Bool;

	@:native("get_comments_link")
	public static function getCommentsLink():String;

	@:native("prepend_attachment")
	public static function prependAttachment(content:String):String;

	@:native("class_exists")
	public static function classExists(className:String):Bool;

	@:native("preg_match")
	public static function pregMatch(pattern:String, subject:String):Int;

	@:native("wphx_embed_preg_match")
	public static function pregMatchCapture(pattern:String, subject:String):php.NativeArray;

	@:native("wp_allowed_protocols")
	public static function wpAllowedProtocols():php.NativeArray;

	@:native("wp_kses_hair")
	public static function wpKsesHair(attr:String, protocols:php.NativeArray):php.NativeArray;

	@:native("wp_list_pluck")
	public static function wpListPluck(inputList:php.NativeArray, field:String):php.NativeArray;

	@:native("wp_enqueue_script")
	public static function wpEnqueueScript(handle:String):Void;

	@:native("wp_scripts_get_suffix")
	public static function wpScriptsGetSuffix():String;

	@:native("wp_register_style")
	public static function wpRegisterStyle(handle:String, source:NativeValue):Void;

	@:native("wp_add_inline_style")
	public static function wpAddInlineStyle(handle:String, data:String):Void;

	@:native("wp_enqueue_style")
	public static function wpEnqueueStyle(handle:String):Void;

	@:native("file_get_contents")
	public static function fileGetContents(path:String):String;

	@:native("trim")
	public static function trim(value:String):String;

	@:native("wp_print_inline_script_tag")
	public static function wpPrintInlineScriptTag(script:String):Void;

	@:native("get_oembed_response_data_for_url")
	public static function getOembedResponseDataForUrl(url:String, args:NativeValue):NativeValue;

	@:native("wphx_embed_array_set")
	public static function arraySet(array:php.NativeArray, key:String, value:NativeValue):Void;

	@:native("wphx_embed_array_unset")
	public static function arrayUnset(array:php.NativeArray, key:String):Void;

	// WPHX-211: PHP truthiness is needed for globals and raw handler attributes.
	@:native("wphx_embed_truthy")
	public static function truthy(value:NativeValue):Bool;

	// WPHX-211: oEmbed provider data is a public PHP object with dynamic fields.
	@:native("wphx_embed_object_field")
	public static function objectField(value:NativeValue, field:String):NativeValue;
}

/**
	Typed subset of WP_oEmbed state used by selected provider registry helpers.
**/
@:native("WP_oEmbed")
extern class WpOembed
{
	public var providers:php.NativeArray;

	public function new():Void;

	@:native("get_html")
	public function getHtml(url:String, args:NativeValue):NativeValue;

	@:native("data2html")
	public function dataToHtml(data:NativeValue, url:String):NativeValue;

	@:native("_add_provider_early")
	public static function addProviderEarly(format:String, provider:String, regex:Bool):Void;

	@:native("_remove_provider_early")
	public static function removeProviderEarly(format:String):Void;
}

/**
	Typed subset of the oEmbed REST controller used by route registration.
**/
@:native("WP_oEmbed_Controller")
extern class WpOembedController
{
	public function new():Void;

	@:native("register_routes")
	public function registerRoutes():Void;
}

/**
	Typed subset of WP_HTML_Tag_Processor used by feed-content embed cleanup.
**/
@:native("WP_HTML_Tag_Processor")
extern class WpHtmlTagProcessor
{
	public function new(html:String):Void;

	@:native("next_tag")
	public function nextTag(query:php.NativeArray):Bool;

	@:native("has_class")
	public function hasClass(className:String):Bool;

	@:native("remove_attribute")
	public function removeAttribute(attributeName:String):Void;

	@:native("get_updated_html")
	public function getUpdatedHtml():String;
}

/**
	Narrow extern for SimpleXML nodes used by WordPress oEmbed XML output.
**/
@:native("SimpleXMLElement")
extern class SimpleXmlElement
{
	public function new(xml:String):Void;

	@:native("addChild")
	public function addChild(key:String, ?value:String):SimpleXmlElement;

	@:native("asXML")
	public function asXml():NativeValue;
}

/**
	Typed subset of WP_Embed handler registry methods used by selected module functions.
**/
extern class WpEmbed
{
	@:native("register_handler")
	public function registerHandler(id:String, regex:String, callback:NativeValue, priority:Int):Void;

	@:native("unregister_handler")
	public function unregisterHandler(id:String, priority:Int):Void;

	@:native("autoembed")
	public function autoembed(url:String):String;
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class EmbedHooks
{
	@:native("apply_filters")
	public static function applyFiltersNative1(hookName:String, value:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersNative2(hookName:String, value:NativeValue, arg:NativeValue):NativeValue;

	@:native("apply_filters")
	public static function applyFiltersString3(hookName:String, value:String, arg1:String, arg2:String):String;

	@:native("apply_filters")
	public static function applyFiltersNative4(hookName:String, value:NativeValue, arg1:NativeValue, arg2:NativeValue, arg3:NativeValue):NativeValue;
}
