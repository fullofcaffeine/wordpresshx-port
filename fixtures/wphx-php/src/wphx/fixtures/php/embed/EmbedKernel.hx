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

	public static function postEmbedHtml(width:Int, height:Int, post:NativeValue = null):NativeValue
	{
		final resolvedPost = EmbedGlobals.getPost(post);
		if (!EmbedGlobals.truthy(resolvedPost))
		{
			return false;
		}

		final secret = EmbedGlobals.wpGeneratePassword(10, false);
		final embedUrl = EmbedGlobals.strval(postEmbedUrl(resolvedPost)) + "#?secret=" + secret;
		var output = EmbedGlobals.sprintfThree("<blockquote class=\"wp-embedded-content\" data-secret=\"%s\"><a href=\"%s\">%s</a></blockquote>",
			EmbedGlobals.escAttr(secret), EmbedGlobals.escUrl(EmbedGlobals.getPermalinkForPost(resolvedPost)), EmbedGlobals.getTheTitleForPost(resolvedPost));
		output += EmbedGlobals.sprintfFive("<iframe sandbox=\"allow-scripts\" security=\"restricted\" src=\"%s\" width=\"%d\" height=\"%d\" title=\"%s\" data-secret=\"%s\" frameborder=\"0\" marginwidth=\"0\" marginheight=\"0\" scrolling=\"no\" class=\"wp-embedded-content\"></iframe>",
			EmbedGlobals.escUrl(embedUrl), EmbedGlobals.absint(width), EmbedGlobals.absint(height),
			EmbedGlobals.escAttr(EmbedGlobals.sprintfTwo(EmbedGlobals.translate("&#8220;%1$s&#8221; &#8212; %2$s"),
				EmbedGlobals.getTheTitleForPost(resolvedPost), EmbedGlobals.getBloginfo("name"))),
			EmbedGlobals.escAttr(secret));

		final jsPath = "/js/wp-embed" + EmbedGlobals.wpScriptsGetSuffix() + ".js";
		output += EmbedGlobals.wpGetInlineScriptTag(EmbedGlobals.trim(EmbedGlobals.fileGetContents(wpIncludesPath(jsPath)))
			+ "\n//# sourceURL="
			+ EmbedGlobals.escUrlRaw(EmbedGlobals.includesUrl(jsPath)));

		return EmbedHooks.applyFiltersNative4("embed_html", output, resolvedPost, width, height);
	}

	public static function oembedResponseData(post:NativeValue, width:Int):NativeValue
	{
		final resolvedPost = EmbedGlobals.getPost(post);
		width = EmbedGlobals.absint(width);

		if (!EmbedGlobals.truthy(resolvedPost))
		{
			return false;
		}

		if (!EmbedGlobals.isPostPubliclyViewable(resolvedPost))
		{
			return false;
		}

		if (!EmbedGlobals.isPostEmbeddable(resolvedPost))
		{
			return false;
		}

		final minMaxWidth = EmbedHooks.applyFiltersNative1("oembed_min_max_width", oembedMinMaxWidth());
		// WPHX-211: WordPress exposes the min/max width policy as a native associative array filter value.
		final minWidth = EmbedGlobals.intval(WpNativeArray.get(cast minMaxWidth, "min", 200));
		final maxWidth = EmbedGlobals.intval(WpNativeArray.get(cast minMaxWidth, "max", 600));
		width = Std.int(Math.min(Math.max(minWidth, width), maxWidth));
		final height = Std.int(Math.max(Math.ceil(width / 16 * 9), 200));

		final blogName = EmbedGlobals.getBloginfo("name");
		final home = EmbedGlobals.getHomeUrl();
		final data = oembedResponsePayload(blogName, home, blogName, home, EmbedGlobals.getTheTitleForPost(resolvedPost));
		final author = EmbedGlobals.getUserdata(EmbedGlobals.objectField(resolvedPost, "post_author"));
		if (EmbedGlobals.truthy(author))
		{
			// WPHX-211: WP_User arrives as a native PHP object with public fields consumed by the oEmbed array.
			EmbedGlobals.arraySet(data, "author_name", EmbedGlobals.objectField(author, "display_name"));
			EmbedGlobals.arraySet(data, "author_url", EmbedGlobals.getAuthorPostsUrl(EmbedGlobals.objectField(author, "ID")));
		}

		return EmbedHooks.applyFiltersNative4("oembed_response_data", data, resolvedPost, width, height);
	}

	public static function oembedResponseDataRich(data:NativeValue, post:NativeValue, width:Int, height:Int):NativeValue
	{
		// WPHX-211: get_oembed_response_data_rich() mutates the public native PHP oEmbed response array.
		final dataArray:php.NativeArray = cast data;
		EmbedGlobals.arraySet(dataArray, "width", EmbedGlobals.absint(width));
		EmbedGlobals.arraySet(dataArray, "height", EmbedGlobals.absint(height));
		EmbedGlobals.arraySet(dataArray, "type", "rich");
		EmbedGlobals.arraySet(dataArray, "html", postEmbedHtml(width, height, post));

		var thumbnailId:NativeValue = false;
		final postId = EmbedGlobals.objectField(post, "ID");
		if (EmbedGlobals.hasPostThumbnail(postId))
		{
			thumbnailId = EmbedGlobals.getPostThumbnailId(postId);
		}

		if (EmbedGlobals.getPostType(post) == "attachment")
		{
			if (EmbedGlobals.wpAttachmentIsImage(post))
			{
				thumbnailId = postId;
			} else if (EmbedGlobals.wpAttachmentIs("video", post))
			{
				thumbnailId = EmbedGlobals.getPostThumbnailId(post);
				EmbedGlobals.arraySet(dataArray, "type", "video");
			}
		}

		if (EmbedGlobals.truthy(thumbnailId))
		{
			final imageSrc = EmbedGlobals.wpGetAttachmentImageSrc(thumbnailId, attachmentImageSize(width));
			// WPHX-211: wp_get_attachment_image_src() returns a native indexed tuple.
			EmbedGlobals.arraySet(dataArray, "thumbnail_url", WpNativeArray.get(imageSrc, 0, ""));
			EmbedGlobals.arraySet(dataArray, "thumbnail_width", WpNativeArray.get(imageSrc, 1, 0));
			EmbedGlobals.arraySet(dataArray, "thumbnail_height", WpNativeArray.get(imageSrc, 2, 0));
		}

		return dataArray;
	}

	public static function oembedResponseDataForUrl(url:String, args:NativeValue):NativeValue
	{
		var switchedBlog = false;

		if (EmbedGlobals.isMultisite())
		{
			final urlParts = EmbedGlobals.wpParseArgs(EmbedGlobals.wpParseUrl(url), urlPartDefaults());
			// WPHX-211: wp_parse_args(wp_parse_url()) returns a native associative URL-parts array.
			final urlPartsArray:php.NativeArray = cast urlParts;
			final port = WpNativeArray.get(urlPartsArray, "port", null);
			final domain = EmbedGlobals.strval(WpNativeArray.get(urlPartsArray, "host", ""))
				+ (EmbedGlobals.truthy(port) ? ":" + EmbedGlobals.strval(port) : "");
			final qv = siteQueryArgs(domain);

			if (!EmbedGlobals.isSubdomainInstall())
			{
				final pathParts = EmbedGlobals.explode("/", EmbedGlobals.ltrim(EmbedGlobals.strval(WpNativeArray.get(urlPartsArray, "path", "/")), "/"));
				final path = EmbedGlobals.reset(pathParts);
				if (EmbedGlobals.truthy(path))
				{
					EmbedGlobals.arraySet(qv, "path", objectFieldString(EmbedGlobals.getNetwork(), "path") + EmbedGlobals.strval(path) + "/");
				}
			}

			final sites = EmbedGlobals.getSites(qv);
			final site = EmbedGlobals.reset(sites);
			if (EmbedGlobals.truthy(site)
				&& (objectFieldTruthy(site, "deleted") || objectFieldTruthy(site, "spam") || objectFieldTruthy(site, "archived")))
			{
				return false;
			}

			if (EmbedGlobals.truthy(site)
				&& EmbedGlobals.getCurrentBlogId() != EmbedGlobals.intval(EmbedGlobals.objectField(site, "blog_id")))
			{
				EmbedGlobals.switchToBlog(EmbedGlobals.objectField(site, "blog_id"));
				switchedBlog = true;
			}
		}

		var postId:NativeValue = EmbedGlobals.urlToPostId(url);
		postId = EmbedHooks.applyFiltersNative2("oembed_request_post_id", postId, url);
		if (!EmbedGlobals.truthy(postId))
		{
			if (switchedBlog)
			{
				EmbedGlobals.restoreCurrentBlog();
			}

			return false;
		}

		// WPHX-211: get_oembed_response_data_for_url() accepts native PHP args arrays from REST/oEmbed callers.
		final argsArray:php.NativeArray = cast args;
		final width = EmbedGlobals.intval(WpNativeArray.get(argsArray, "width", 0));
		final data = oembedResponseData(postId, width);
		if (switchedBlog)
		{
			EmbedGlobals.restoreCurrentBlog();
		}

		return EmbedGlobals.truthy(data) ? nativeObject(data) : false;
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
		final data = oembedResponseDataForUrl(url, args);
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

	public static function filterOembedResult(result:NativeValue, data:NativeValue, url:String):NativeValue
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

		final oembed = oembedGetObject();
		if (!strictFalse(oembed.getProvider(url, providerDiscoveryFalse())))
		{
			return result;
		}

		var allowedHtml = oembedAllowedHtml(false);
		var html = EmbedGlobals.wpKses(EmbedGlobals.strval(result), allowedHtml);
		final content = EmbedGlobals.pregMatchCapture("|(<blockquote>.*?</blockquote>)?.*(<iframe.*?></iframe>)|ms", html);
		if (!EmbedGlobals.truthy(WpNativeArray.get(content, 2, "")))
		{
			return false;
		}

		final blockquote = EmbedGlobals.strval(WpNativeArray.get(content, 1, ""));
		html = blockquote + EmbedGlobals.strval(WpNativeArray.get(content, 2, ""));

		final srcResults = EmbedGlobals.pregMatchCapture("/ src=([\\'\\\"])(.*?)\\1/", html);
		if (WpNativeArray.count(srcResults) > 0)
		{
			final secret = EmbedGlobals.wpGeneratePassword(10, false);
			final srcUrl = EmbedGlobals.escUrl(EmbedGlobals.strval(WpNativeArray.get(srcResults, 2, "")) + "#?secret=" + secret);
			final quote = EmbedGlobals.strval(WpNativeArray.get(srcResults, 1, ""));
			html = EmbedGlobals.strReplace(EmbedGlobals.strval(WpNativeArray.get(srcResults, 0, "")),
				" src="
				+ quote
				+ srcUrl
				+ quote
				+ " data-secret="
				+ quote
				+ secret
				+ quote, html);
			html = EmbedGlobals.strReplace("<blockquote", "<blockquote data-secret=\"" + secret + "\"", html);
		}

		allowedHtml = oembedAllowedHtml(true);
		html = EmbedGlobals.wpKses(html, allowedHtml);
		if (blockquote != "")
		{
			html = EmbedGlobals.strReplace("<iframe", "<iframe style=\"position: absolute; visibility: hidden;\"", html);
			html = EmbedGlobals.strReplace("<blockquote", "<blockquote class=\"wp-embedded-content\"", html);
		}

		return EmbedGlobals.strIreplace("<iframe", "<iframe class=\"wp-embedded-content\" sandbox=\"allow-scripts\" security=\"restricted\"", html);
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

	public static function printEmbedSharingDialog():String
	{
		if (EmbedGlobals.is404())
		{
			return "";
		}

		final uniqueSuffix = EmbedGlobals.strval(EmbedGlobals.getTheId()) + "-" + EmbedGlobals.strval(EmbedGlobals.wpRand());
		final shareTabWordpressId = "wp-embed-share-tab-wordpress-" + uniqueSuffix;
		final shareTabHtmlId = "wp-embed-share-tab-html-" + uniqueSuffix;
		final descriptionWordpressId = "wp-embed-share-description-wordpress-" + uniqueSuffix;
		final descriptionHtmlId = "wp-embed-share-description-html-" + uniqueSuffix;

		return "\t<div class=\"wp-embed-share-dialog hidden\" role=\"dialog\" aria-label=\""
			+ EmbedGlobals.escAttr(EmbedGlobals.translate("Sharing options"))
			+
			"\">\n\t\t<div class=\"wp-embed-share-dialog-content\">\n\t\t\t<div class=\"wp-embed-share-dialog-text\">\n\t\t\t\t<ul class=\"wp-embed-share-tabs\" role=\"tablist\">\n\t\t\t\t\t<li class=\"wp-embed-share-tab-button wp-embed-share-tab-button-wordpress\" role=\"presentation\">\n\t\t\t\t\t\t<button type=\"button\" role=\"tab\" aria-controls=\""
			+ shareTabWordpressId
			+ "\" aria-selected=\"true\" tabindex=\"0\">"
			+ EmbedGlobals.escHtml(EmbedGlobals.translate("WordPress Embed"))
			+
			"</button>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li class=\"wp-embed-share-tab-button wp-embed-share-tab-button-html\" role=\"presentation\">\n\t\t\t\t\t\t<button type=\"button\" role=\"tab\" aria-controls=\""
			+ shareTabHtmlId
			+ "\" aria-selected=\"false\" tabindex=\"-1\">"
			+ EmbedGlobals.escHtml(EmbedGlobals.translate("HTML Embed"))
			+ "</button>\n\t\t\t\t\t</li>\n\t\t\t\t</ul>\n\t\t\t\t<div id=\""
			+ shareTabWordpressId
			+ "\" class=\"wp-embed-share-tab\" role=\"tabpanel\" aria-hidden=\"false\">\n\t\t\t\t\t<input type=\"text\" value=\""
			+ EmbedGlobals.escUrl(EmbedGlobals.getPermalink())
			+ "\" class=\"wp-embed-share-input\" aria-label=\""
			+ EmbedGlobals.escAttr(EmbedGlobals.translate("URL"))
			+ "\" aria-describedby=\""
			+ descriptionWordpressId
			+ "\" tabindex=\"0\" readonly/>\n\n\t\t\t\t\t<p class=\"wp-embed-share-description\" id=\""
			+ descriptionWordpressId
			+ "\">\n\t\t\t\t\t\t"
			+ EmbedGlobals.translate("Copy and paste this URL into your WordPress site to embed")
			+ "\t\t\t\t\t</p>\n\t\t\t\t</div>\n\t\t\t\t<div id=\""
			+ shareTabHtmlId
			+ "\" class=\"wp-embed-share-tab\" role=\"tabpanel\" aria-hidden=\"true\">\n\t\t\t\t\t<textarea class=\"wp-embed-share-input\" aria-label=\""
			+ EmbedGlobals.escAttr(EmbedGlobals.translate("HTML"))
			+ "\" aria-describedby=\""
			+ descriptionHtmlId
			+ "\" tabindex=\"0\" readonly>"
			+ EmbedGlobals.escTextarea(EmbedGlobals.strval(postEmbedHtml(600, 400, null)))
			+ "</textarea>\n\n\t\t\t\t\t<p class=\"wp-embed-share-description\" id=\""
			+ descriptionHtmlId
			+ "\">\n\t\t\t\t\t\t"
			+ EmbedGlobals.translate("Copy and paste this code into your site to embed")
			+ "\t\t\t\t\t</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<button type=\"button\" class=\"wp-embed-share-dialog-close\" aria-label=\""
			+ EmbedGlobals.escAttr(EmbedGlobals.translate("Close sharing dialog"))
			+ "\">\n\t\t\t\t<span class=\"dashicons dashicons-no\"></span>\n\t\t\t</button>\n\t\t</div>\n\t</div>\n\t";
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

	static function oembedMinMaxWidth():php.NativeArray
	{
		// WPHX-211: oembed_min_max_width exposes the policy as a mutable native associative array.
		return php.Syntax.code("array('min' => 200, 'max' => 600)");
	}

	static function oembedResponsePayload(providerName:String, providerUrl:String, authorName:String, authorUrl:String, title:String):php.NativeArray
	{
		// WPHX-211: public oEmbed responses are native PHP associative arrays for REST/XML consumers.
		return
			php.Syntax.code("array('version' => '1.0', 'provider_name' => {0}, 'provider_url' => {1}, 'author_name' => {2}, 'author_url' => {3}, 'title' => {4}, 'type' => 'link')",
			providerName, providerUrl, authorName, authorUrl, title);
	}

	static function attachmentImageSize(width:Int):php.NativeArray
	{
		// WPHX-211: wp_get_attachment_image_src() consumes native indexed image-size arrays.
		return php.Syntax.code("array({0}, 0)", width);
	}

	static function urlPartDefaults():php.NativeArray
	{
		// WPHX-211: wp_parse_args() merges native URL-part arrays with WordPress defaults.
		return php.Syntax.code("array('host' => '', 'port' => null, 'path' => '/')");
	}

	static function siteQueryArgs(domain:String):php.NativeArray
	{
		// WPHX-211: get_sites() consumes a native query array with false cache flags.
		return php.Syntax.code("array('domain' => {0}, 'path' => '/', 'update_site_meta_cache' => false)", domain);
	}

	static function nativeObject(value:NativeValue):NativeValue
	{
		// WPHX-211: WordPress casts oEmbed response arrays to stdClass objects for REST-facing consumers.
		return php.Syntax.code("(object) {0}", value);
	}

	static function providerPair(provider:String, regex:Bool):php.NativeArray
	{
		// WPHX-211: WordPress stores oEmbed provider tuples as native indexed arrays.
		return php.Syntax.code("array({0}, {1})", provider, regex);
	}

	static function providerDiscoveryFalse():php.NativeArray
	{
		// WPHX-211: WP_oEmbed::get_provider() consumes native PHP args with strict false discovery.
		return php.Syntax.code("array('discover' => false)");
	}

	static function oembedAllowedHtml(includeDataSecret:Bool):php.NativeArray
	{
		// WPHX-211: wp_filter_oembed_result() passes a native KSES allowlist keyed by HTML tag and attribute.
		return
			includeDataSecret ? php.Syntax.code("array('a' => array('href' => true), 'blockquote' => array('data-secret' => true), 'iframe' => array('src' => true, 'width' => true, 'height' => true, 'frameborder' => true, 'marginwidth' => true, 'marginheight' => true, 'scrolling' => true, 'title' => true, 'data-secret' => true))") : php.Syntax.code("array('a' => array('href' => true), 'blockquote' => array(), 'iframe' => array('src' => true, 'width' => true, 'height' => true, 'frameborder' => true, 'marginwidth' => true, 'marginheight' => true, 'scrolling' => true, 'title' => true))");
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

	@:native("esc_textarea")
	public static function escTextarea(value:String):String;

	@:native("home_url")
	public static function homeUrl():String;

	@:native("get_home_url")
	public static function getHomeUrl():String;

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
	public static function sprintfThree(format:String, arg1:String, arg2:String, arg3:String):String;

	@:native("sprintf")
	public static function sprintfFive(format:String, arg1:String, arg2:Int, arg3:Int, arg4:String, arg5:String):String;

	@:native("sprintf")
	public static function sprintfInt(format:String, arg:Int):String;

	@:native("strval")
	public static function strval(value:NativeValue):String;

	@:native("intval")
	public static function intval(value:NativeValue):Int;

	@:native("absint")
	public static function absint(value:NativeValue):Int;

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
	public static function isPostEmbeddable(post:NativeValue = null):Bool;

	@:native("is_post_publicly_viewable")
	public static function isPostPubliclyViewable(post:NativeValue):Bool;

	@:native("get_userdata")
	public static function getUserdata(userId:NativeValue):NativeValue;

	@:native("get_author_posts_url")
	public static function getAuthorPostsUrl(userId:NativeValue):String;

	@:native("has_post_thumbnail")
	public static function hasPostThumbnail(postId:NativeValue):Bool;

	@:native("get_post_thumbnail_id")
	public static function getPostThumbnailId(post:NativeValue):NativeValue;

	@:native("get_post_type")
	public static function getPostType(post:NativeValue):String;

	@:native("wp_attachment_is_image")
	public static function wpAttachmentIsImage(post:NativeValue):Bool;

	@:native("wp_attachment_is")
	public static function wpAttachmentIs(type:String, post:NativeValue):Bool;

	@:native("wp_get_attachment_image_src")
	public static function wpGetAttachmentImageSrc(thumbnailId:NativeValue, size:php.NativeArray):php.NativeArray;

	@:native("is_multisite")
	public static function isMultisite():Bool;

	@:native("wp_parse_url")
	public static function wpParseUrl(url:String):NativeValue;

	@:native("wp_parse_args")
	public static function wpParseArgs(args:NativeValue, defaults:php.NativeArray):NativeValue;

	@:native("is_subdomain_install")
	public static function isSubdomainInstall():Bool;

	@:native("ltrim")
	public static function ltrim(value:String, characters:String):String;

	@:native("explode")
	public static function explode(separator:String, value:String):php.NativeArray;

	@:native("reset")
	public static function reset(value:php.NativeArray):NativeValue;

	@:native("get_network")
	public static function getNetwork():NativeValue;

	@:native("get_sites")
	public static function getSites(query:php.NativeArray):php.NativeArray;

	@:native("get_current_blog_id")
	public static function getCurrentBlogId():Int;

	@:native("switch_to_blog")
	public static function switchToBlog(blogId:NativeValue):Void;

	@:native("restore_current_blog")
	public static function restoreCurrentBlog():Void;

	@:native("url_to_postid")
	public static function urlToPostId(url:String):NativeValue;

	@:native("_x")
	public static function translateWithContext(text:String, context:String):String;

	@:native("get_permalink")
	public static function getPermalink():String;

	@:native("get_the_title")
	public static function getTheTitle():String;

	@:native("get_the_title")
	public static function getTheTitleForPost(post:NativeValue):String;

	@:native("get_the_ID")
	public static function getTheId():NativeValue;

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

	@:native("wp_kses")
	public static function wpKses(html:String, allowedHtml:php.NativeArray):String;

	@:native("wp_list_pluck")
	public static function wpListPluck(inputList:php.NativeArray, field:String):php.NativeArray;

	@:native("wp_generate_password")
	public static function wpGeneratePassword(length:Int, specialChars:Bool):String;

	@:native("wp_rand")
	public static function wpRand():NativeValue;

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

	@:native("wp_get_inline_script_tag")
	public static function wpGetInlineScriptTag(script:String):String;

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

	@:native("get_provider")
	public function getProvider(url:String, args:NativeValue):NativeValue;

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
