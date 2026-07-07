package wphx.wp.themes;

using StringTools;

/**
	Typed HXX-style default theme markup pilot for a bounded WPHX-320 template unit.

	This module owns small block-pattern and navigation markup fragments with typed
	inputs and WordPress-style escaping. It is fixture evidence for future
	WordPressHX theme markup authoring, not installed theme rendering parity.
**/
typedef ThemeHeroPatternMarkup =
{
	final title:String;
	final summary:String;
	final ctaLabel:String;
	final ctaHref:String;
	final alignWide:Bool;
}

typedef ThemeNavigationItem =
{
	final label:String;
	final href:String;
	final current:Bool;
}

typedef ThemeNavigationMarkup =
{
	final ariaLabel:String;
	final items:Array<ThemeNavigationItem>;
}

enum ThemeHxxTag
{
	Section;
	Div;
	Heading2;
	Paragraph;
	Anchor;
	Navigation;
	UnorderedList;
	ListItem;
}

typedef ThemeHxxAttr =
{
	final name:String;
	final value:String;
}

enum ThemeHxxNode
{
	Element(tag:ThemeHxxTag, attrs:Array<ThemeHxxAttr>, children:Array<ThemeHxxNode>);
	Text(value:String);
	Escaped(value:String);
}

/**
	Renders the pilot AST to ordinary WordPress-compatible PHP/HTML output bytes.
**/
@:keep
class ThemeHxxMarkupPilot
{
	public static function renderHeroPattern(markup:ThemeHeroPatternMarkup):String
	{
		return renderNode(heroPatternNode(markup)) + "\n";
	}

	public static function renderNavigation(markup:ThemeNavigationMarkup):String
	{
		return renderNode(navigationNode(markup)) + "\n";
	}

	public static function heroPatternNode(markup:ThemeHeroPatternMarkup):ThemeHxxNode
	{
		final classes = ["wp-block-group", "wphx-theme-hero"];
		if (markup.alignWide)
		{
			classes.insert(1, "alignwide");
		}

		return Element(Section, [attr("class", classes.join(" "))], [
			Text("\n\t"),
			Element(Div, [attr("class", "wp-block-group__inner-container")], [
				Text("\n\t\t"),
				Element(Heading2, [], [Escaped(markup.title)]),
				Text("\n\t\t"),
				Element(Paragraph, [], [Escaped(markup.summary)]),
				Text("\n\t\t"),
				Element(Anchor, [attr("class", "wp-block-button__link"), attr("href", markup.ctaHref)], [Escaped(markup.ctaLabel)]),
				Text("\n\t")
			]),
			Text("\n")
		]);
	}

	public static function navigationNode(markup:ThemeNavigationMarkup):ThemeHxxNode
	{
		final itemNodes = new Array<ThemeHxxNode>();
		for (item in markup.items)
		{
			itemNodes.push(Text("\n\t\t"));
			itemNodes.push(Element(ListItem, [attr("class", navigationItemClass(item.current))],
				[Element(Anchor, [attr("href", item.href)], [Escaped(item.label)])]));
		}
		itemNodes.push(Text("\n\t"));

		return Element(Navigation, [attr("class", "wp-block-navigation"), attr("aria-label", markup.ariaLabel)], [
			Text("\n\t"),
			Element(UnorderedList, [attr("class", "wp-block-navigation__container")], itemNodes),
			Text("\n")
		]);
	}

	static function renderNode(node:ThemeHxxNode):String
	{
		return switch node
		{
			case Text(value):
				value;
			case Escaped(value):
				escapeHtml(value);
			case Element(tag, attrs, children):
				final name = tagName(tag);
				final buf = new StringBuf();
				buf.add("<");
				buf.add(name);
				for (attribute in attrs)
				{
					buf.add(" ");
					buf.add(attribute.name);
					buf.add("=\"");
					buf.add(escapeHtml(attribute.value));
					buf.add("\"");
				}
				buf.add(">");
				for (child in children)
				{
					buf.add(renderNode(child));
				}
				buf.add("</");
				buf.add(name);
				buf.add(">");
				buf.toString();
		}
	}

	static function tagName(tag:ThemeHxxTag):String
	{
		return switch tag
		{
			case Section: "section";
			case Div: "div";
			case Heading2: "h2";
			case Paragraph: "p";
			case Anchor: "a";
			case Navigation: "nav";
			case UnorderedList: "ul";
			case ListItem: "li";
		}
	}

	static function attr(name:String, value:String):ThemeHxxAttr
	{
		return {
			name: name,
			value: value
		};
	}

	static function navigationItemClass(current:Bool):String
	{
		final classes = ["wp-block-navigation-item"];
		if (current)
		{
			classes.push("current-menu-item");
		}
		return classes.join(" ");
	}

	static function escapeHtml(value:String):String
	{
		return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#039;");
	}
}
