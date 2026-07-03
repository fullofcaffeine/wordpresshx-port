package wphx.wp.admin;

using StringTools;

/**
	Typed HXX-style admin markup pilot for a bounded WPHX-315 template unit.

	This module owns a small notice/list-table row markup AST with typed inputs
	and WordPress-style escaping. It is fixture evidence for a future WordPressHX
	HXX authoring path, not installed admin behavior or public PHP replacement.
**/
enum AdminNoticeLevel
{
	Success;
	Warning;
	Error;
	Info;
}

typedef AdminNoticeMarkup =
{
	final level:AdminNoticeLevel;
	final message:String;
	final dismissible:Bool;
}

typedef AdminRowAction =
{
	final key:String;
	final label:String;
	final href:String;
	final separator:String;
}

typedef AdminListTableRowMarkup =
{
	final id:Int;
	final title:String;
	final editHref:String;
	final classes:Array<String>;
	final actions:Array<AdminRowAction>;
}

enum AdminHxxTag
{
	Div;
	P;
	TableRow;
	TableCell;
	Strong;
	Anchor;
	Span;
	Button;
}

typedef AdminHxxAttr =
{
	final name:String;
	final value:String;
}

enum AdminHxxNode
{
	Element(tag:AdminHxxTag, attrs:Array<AdminHxxAttr>, children:Array<AdminHxxNode>);
	Text(value:String);
	Escaped(value:String);
}

/**
	Renders the pilot AST to ordinary WordPress-compatible PHP/HTML output bytes.
**/
@:keep
class AdminHxxMarkupPilot
{
	public static function renderNotice(markup:AdminNoticeMarkup):String
	{
		return renderNode(noticeNode(markup)) + "\n";
	}

	public static function renderListTableRow(markup:AdminListTableRowMarkup):String
	{
		return renderNode(listTableRowNode(markup));
	}

	public static function noticeNode(markup:AdminNoticeMarkup):AdminHxxNode
	{
		final classes = ["notice", "notice-" + noticeLevelClass(markup.level)];
		if (markup.dismissible)
		{
			classes.push("is-dismissible");
		}
		return Element(Div, [attr("class", classes.join(" "))], [Element(P, [], [Escaped(markup.message)])]);
	}

	public static function listTableRowNode(markup:AdminListTableRowMarkup):AdminHxxNode
	{
		final actionChildren = new Array<AdminHxxNode>();
		for (action in markup.actions)
		{
			actionChildren.push(Element(Span, [attr("class", action.key)], [
				Element(Anchor, [attr("href", action.href)], [Escaped(action.label)]),
				Text(action.separator)
			]));
		}

		return Element(TableRow, [attr("id", "post-" + markup.id), attr("class", markup.classes.join(" "))], [
			Text("\n\t"),
			Element(TableCell, [
				attr("class", "title column-title has-row-actions column-primary"),
				attr("data-colname", "Title")
			], [
				Text("\n\t\t"),
				Element(Strong, [],
					[
						Element(Anchor, [attr("class", "row-title"), attr("href", markup.editHref)], [Escaped(markup.title)])
					]),
				Text("\n\t\t"),
				Element(Div, [attr("class", "row-actions")], actionChildren),
				Text("\n\t\t"),
				Element(Button, [attr("type", "button"), attr("class", "toggle-row")], [
					Element(Span, [attr("class", "screen-reader-text")], [Text("Show more details")])
				]),
				Text("\n\t")
			]),
			Text("\n")
		]);
	}

	static function renderNode(node:AdminHxxNode):String
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
				tagTrailingNewline(tag, buf);
				buf.toString();
		}
	}

	static function tagTrailingNewline(tag:AdminHxxTag, buf:StringBuf):Void
	{
		switch tag
		{
			case TableRow:
				buf.add("\n");
			case Div, P, TableCell, Strong, Anchor, Span, Button:
		}
	}

	static function tagName(tag:AdminHxxTag):String
	{
		return switch tag
		{
			case Div: "div";
			case P: "p";
			case TableRow: "tr";
			case TableCell: "td";
			case Strong: "strong";
			case Anchor: "a";
			case Span: "span";
			case Button: "button";
		}
	}

	static function attr(name:String, value:String):AdminHxxAttr
	{
		return {
			name: name,
			value: value
		};
	}

	static function noticeLevelClass(level:AdminNoticeLevel):String
	{
		return switch level
		{
			case Success: "success";
			case Warning: "warning";
			case Error: "error";
			case Info: "info";
		}
	}

	static function escapeHtml(value:String):String
	{
		return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#039;");
	}
}
