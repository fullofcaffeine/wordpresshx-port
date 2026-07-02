package wphx.fixtures.php.feed;

import php.Const;
import php.Global;
import php.NativeIndexedArray;
import php.SuperGlobal;
import wphx.wp.boundary.NativeArray as WpNativeArray;
import wphx.wp.boundary.NativeValue.NativeValue;

using StringTools;

/**
	Selected feed helper behavior owned by Haxe behind original-path PHP functions.
**/
@:keep
class FeedKernel
{
	public static function getBloginfoRss(show:String):String
	{
		final info = WpFeedGlobals.stripTags(WpFeedGlobals.getBloginfo(show));
		return WpHooks.applyFilters2("get_bloginfo_rss", WpFeedGlobals.convertChars(info), show);
	}

	public static function bloginfoRss(show:String):String
	{
		return WpHooks.applyFilters2("bloginfo_rss", getBloginfoRss(show), show);
	}

	public static function defaultFeed():String
	{
		final defaultFeed = WpHooks.applyFilters1("default_feed", "rss2");
		return defaultFeed == "rss" ? "rss2" : defaultFeed;
	}

	public static function getWpTitleRss(deprecated:String):String
	{
		if (deprecated != "&#8211;")
		{
			WpFeedGlobals.deprecatedArgument("get_wp_title_rss", "4.4.0",
				WpFeedGlobals.sprintf(WpFeedGlobals.translate("Use the %s filter instead."), "<code>document_title_separator</code>"));
		}
		return WpHooks.applyFilters2("get_wp_title_rss", WpFeedGlobals.wpGetDocumentTitle(), deprecated);
	}

	public static function wpTitleRss(deprecated:String):String
	{
		if (deprecated != "&#8211;")
		{
			WpFeedGlobals.deprecatedArgument("wp_title_rss", "4.4.0",
				WpFeedGlobals.sprintf(WpFeedGlobals.translate("Use the %s filter instead."), "<code>document_title_separator</code>"));
		}
		return WpHooks.applyFilters2("wp_title_rss", getWpTitleRss("&#8211;"), deprecated);
	}

	public static function getTheTitleRss(post:Int):String
	{
		final title = WpFeedGlobals.getTheTitle(post);
		return WpHooks.applyFilters1("the_title_rss", title);
	}

	public static function theTitleRss():String
	{
		return getTheTitleRss(0);
	}

	public static function theExcerptRss():String
	{
		return WpHooks.applyFilters1("the_excerpt_rss", WpFeedGlobals.getTheExcerpt());
	}

	public static function thePermalinkRss():String
	{
		return WpFeedGlobals.escUrl(WpHooks.applyFilters1("the_permalink_rss", WpFeedGlobals.getPermalink()));
	}

	public static function commentsLinkFeed():String
	{
		return WpFeedGlobals.escUrl(WpHooks.applyFilters1("comments_link_feed", WpFeedGlobals.getCommentsLink()));
	}

	public static function getCommentGuid(commentId:NativeValue):NativeValue
	{
		final comment = WpFeedGlobals.getComment(commentId);
		if (comment == null)
		{
			return false;
		}
		return WpFeedGlobals.getTheGuid(comment.comment_post_ID) + "#comment-" + comment.comment_ID;
	}

	public static function commentGuid(commentId:NativeValue):String
	{
		return WpFeedGlobals.escUrl(getCommentGuid(commentId));
	}

	public static function commentLink(comment:NativeValue):String
	{
		return WpFeedGlobals.escUrl(WpHooks.applyFilters1("comment_link", WpFeedGlobals.getCommentLink(comment)));
	}

	public static function getCommentAuthorRss():String
	{
		return WpHooks.applyFilters1("comment_author_rss", WpFeedGlobals.getCommentAuthor());
	}

	public static function commentAuthorRss():String
	{
		return getCommentAuthorRss();
	}

	public static function commentTextRss():String
	{
		return WpHooks.applyFilters1("comment_text_rss", WpFeedGlobals.getCommentText());
	}

	public static function getTheContentFeed(feedType:Null<String>):String
	{
		final normalizedFeedType = isPhpEmptyString(feedType) ? defaultFeed() : feedType;
		var content = WpHooks.applyFilters1("the_content", WpFeedGlobals.getTheContent());
		content = WpFeedGlobals.strReplace("]]>", "]]&gt;", content);
		return WpHooks.applyFilters2("the_content_feed", content, normalizedFeedType);
	}

	public static function theContentFeed(feedType:Null<String>):String
	{
		return getTheContentFeed(feedType);
	}

	public static function feedContentType(type:Null<String>):String
	{
		final normalizedType = isPhpEmptyString(type) ? defaultFeed() : type;
		final contentType = switch (normalizedType)
		{
			case "rss" | "rss2":
				"application/rss+xml";
			case "rss-http":
				"text/xml";
			case "atom":
				"application/atom+xml";
			case "rdf":
				"application/rdf+xml";
			case _:
				"application/octet-stream";
		}
		return WpHooks.applyFilters2("feed_content_type", contentType, normalizedType);
	}

	public static function getTheCategoryRss(type:Null<String>):String
	{
		final normalizedType = isPhpEmptyString(type) ? defaultFeed() : type;
		final filter = normalizedType == "atom" ? "raw" : "rss";
		final categoryNames:Array<String> = [];
		for (category in WpFeedGlobals.getTheCategory())
		{
			addUnique(categoryNames, WpFeedGlobals.sanitizeTermField("name", category.name, category.term_id, "category", filter));
		}
		for (tag in WpFeedGlobals.getTheTags())
		{
			addUnique(categoryNames, WpFeedGlobals.sanitizeTermField("name", tag.name, tag.term_id, "post_tag", filter));
		}

		var list = "";
		for (categoryName in categoryNames)
		{
			if (normalizedType == "rdf")
			{
				list += "\t\t<dc:subject><![CDATA[" + categoryName + "]]></dc:subject>\n";
			} else if (normalizedType == "atom")
			{
				list += WpFeedGlobals.sprintfCategory("<category scheme=\"%1$s\" term=\"%2$s\" />", WpFeedGlobals.escAttr(getBloginfoRss("url")),
					WpFeedGlobals.escAttr(categoryName));
			} else
			{
				list += "\t\t<category><![CDATA["
					+ Global.html_entity_decode(categoryName, Const.ENT_COMPAT, WpFeedGlobals.getOption("blog_charset"))
					+ "]]></category>\n";
			}
		}

		return WpHooks.applyFilters2("the_category_rss", list, normalizedType);
	}

	public static function theCategoryRss(type:Null<String>):String
	{
		return getTheCategoryRss(type);
	}

	public static function htmlTypeRss():String
	{
		final type = WpFeedGlobals.getBloginfo("html_type");
		return type.contains("xhtml") ? "xhtml" : "html";
	}

	public static function atomSiteIcon():String
	{
		final url = WpFeedGlobals.getSiteIconUrl(32);
		return isPhpEmptyString(url) ? "" : "<icon>" + WpFeedGlobals.convertChars(url) + "</icon>\n";
	}

	public static function rss2SiteIcon():String
	{
		var rssTitle = getWpTitleRss("&#8211;");
		if (isPhpEmptyString(rssTitle))
		{
			rssTitle = getBloginfoRss("name");
		}

		final url = WpFeedGlobals.getSiteIconUrl(32);
		if (isPhpEmptyString(url))
		{
			return "";
		}

		return "\n\t<image>\n\t\t<url>"
			+ WpFeedGlobals.convertChars(url)
			+ "</url>\n\t\t<title>"
			+ rssTitle
			+ "</title>\n\t\t<link>"
			+ getBloginfoRss("url")
			+ "</link>\n\t\t<width>32</width>\n\t\t<height>32</height>\n\t</image> \n";
	}

	public static function getSelfLink():String
	{
		final parsed = WpFeedGlobals.parseUrl(WpFeedGlobals.homeUrl());
		var domain = WpFeedGlobals.strval(WpNativeArray.get(parsed, "host", ""));
		if (WpNativeArray.keyExists(parsed, "port"))
		{
			domain += ":" + WpFeedGlobals.strval(WpNativeArray.get(parsed, "port", ""));
		}

		final requestUri = WpFeedGlobals.strval(WpNativeArray.get(SuperGlobal._SERVER, "REQUEST_URI", ""));
		return WpFeedGlobals.setUrlScheme("http://" + domain + WpFeedGlobals.wpUnslash(requestUri));
	}

	public static function selfLink():String
	{
		return WpFeedGlobals.escUrl(WpHooks.applyFilters1("self_link", getSelfLink()));
	}

	static function isPhpEmptyString(value:Null<String>):Bool
	{
		return value == null || value == "" || value == "0";
	}

	static function addUnique(values:Array<String>, value:String):Void
	{
		if (!values.contains(value))
		{
			values.push(value);
		}
	}
}

/**
	Narrow externs for WordPress feed helper calls preserved at the PHP boundary.
**/
@:phpGlobal
extern class WpFeedGlobals
{
	@:native("strip_tags")
	public static function stripTags(value:String):String;

	@:native("get_bloginfo")
	public static function getBloginfo(show:String):String;

	@:native("convert_chars")
	public static function convertChars(value:String):String;

	@:native("_deprecated_argument")
	public static function deprecatedArgument(functionName:String, version:String, message:String):Void;

	@:native("__")
	public static function translate(message:String):String;

	@:native("sprintf")
	public static function sprintf(format:String, arg:String):String;

	@:native("sprintf")
	public static function sprintfCategory(format:String, arg1:String, arg2:String):String;

	@:native("wp_get_document_title")
	public static function wpGetDocumentTitle():String;

	@:native("get_the_title")
	public static function getTheTitle(post:Int):String;

	@:native("get_the_content")
	public static function getTheContent():String;

	@:native("get_the_excerpt")
	public static function getTheExcerpt():String;

	@:native("get_permalink")
	public static function getPermalink():String;

	@:native("get_comments_link")
	public static function getCommentsLink():String;

	@:native("get_the_category")
	public static function getTheCategory():NativeIndexedArray<WpTerm>;

	@:native("get_the_tags")
	public static function getTheTags():NativeIndexedArray<WpTerm>;

	@:native("sanitize_term_field")
	public static function sanitizeTermField(field:String, value:String, termId:Int, taxonomy:String, context:String):String;

	@:native("esc_attr")
	public static function escAttr(value:String):String;

	@:native("get_option")
	public static function getOption(name:String):String;

	@:native("get_site_icon_url")
	public static function getSiteIconUrl(size:Int):String;

	@:native("home_url")
	public static function homeUrl():String;

	@:native("parse_url")
	public static function parseUrl(url:String):php.NativeArray;

	@:native("strval")
	public static function strval(value:NativeValue):String;

	@:native("wp_unslash")
	public static function wpUnslash(value:String):String;

	@:native("set_url_scheme")
	public static function setUrlScheme(url:String):String;

	@:native("get_comment")
	public static function getComment(commentId:NativeValue):Null<WpComment>;

	@:native("get_the_guid")
	public static function getTheGuid(postId:Int):String;

	@:native("get_comment_link")
	public static function getCommentLink(comment:NativeValue):String;

	@:native("get_comment_author")
	public static function getCommentAuthor():String;

	@:native("get_comment_text")
	public static function getCommentText():String;

	@:native("esc_url")
	public static function escUrl(value:NativeValue):String;

	@:native("str_replace")
	public static function strReplace(search:String, replace:String, subject:String):String;
}

/**
	Typed subset of the comment object fields used by selected feed helpers.
**/
extern class WpComment
{
	public var comment_post_ID:Int;
	public var comment_ID:Int;
}

/**
	Typed subset of the term object fields used by selected category feed helpers.
**/
extern class WpTerm
{
	public var name:String;
	public var term_id:Int;
}

/**
	Narrow extern for WordPress filter dispatch at the public PHP boundary.
**/
@:phpGlobal
extern class WpHooks
{
	@:native("apply_filters")
	public static function applyFilters1(hookName:String, value:String):String;

	@:native("apply_filters")
	public static function applyFilters2(hookName:String, value:String, arg:String):String;
}
