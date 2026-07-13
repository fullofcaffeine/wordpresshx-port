package wphx.fixtures.genes.react;

import genes.react.Element;
import genes.react.JSX.*;
import genes.ts.Undefinable;

/**
 * Haxe-owned F9 candidate for Gutenberg's recursive Table of Contents list.
 *
 * The fixture deliberately preserves the component's observable React boundary:
 * linked and unlinked headings, disabled-link click prevention, ARIA state,
 * ordered or unordered nested lists, fragments, and recursive children.
 */
class TableOfContentsList
{
	public static function Component(props:TableOfContentsListProps):Element
	{
		final entries = props.nestedHeadingList.map(node -> renderEntry(node, props));
		return jsx('<>{entries}</>');
	}

	static function renderEntry(node:NestedHeadingData, props:TableOfContentsListProps):Element
	{
		final heading = node.heading;
		final content = renderContent(heading, props);
		final children = renderChildren(node.children, props);
		return jsx('<li key={heading.link + heading.content}>{content}{children}</li>');
	}

	static function renderContent(heading:HeadingData, props:TableOfContentsListProps):Element
	{
		if (heading.link == "")
			return jsx('<span className={"wp-block-table-of-contents__entry"}>{heading.content}</span>');

		// React models omitted attributes and handlers as `undefined`, not `null`.
		// These typed genes-ts markers preserve that host distinction without
		// weakening the Haxe event contract or embedding raw target syntax here.
		final ariaDisabled:Undefinable<Bool> = props.disableLinkActivation ? true : Undefinable.absent();
		final clickHandler:Undefinable<TableOfContentsClickHandler> = props.disableLinkActivation ? props.onClick : Undefinable.absent();
		return
			jsx('<a className={"wp-block-table-of-contents__entry"} href={heading.link} aria-disabled={ariaDisabled} onClick={clickHandler}>{heading.content}</a>');
	}

	static function renderChildren(children:Null<Array<NestedHeadingData>>, props:TableOfContentsListProps):Null<Element>
	{
		if (children == null)
			return null;

		final nested = Component({
			nestedHeadingList: children,
			disableLinkActivation: props.disableLinkActivation,
			onClick: props.disableLinkActivation ? props.onClick : Undefinable.absent(),
			ordered: props.ordered
		});
		return props.ordered ? jsx('<ol>{nested}</ol>') : jsx('<ul>{nested}</ul>');
	}
}

typedef HeadingData =
{
	final content:String;
	final level:Int;
	final link:String;
}

typedef NestedHeadingData =
{
	final heading:HeadingData;
	final children:Null<Array<NestedHeadingData>>;
}

typedef TableOfContentsListProps =
{
	final nestedHeadingList:Array<NestedHeadingData>;
	final disableLinkActivation:Bool;
	final onClick:Undefinable<TableOfContentsClickHandler>;
	final ordered:Bool;
}

typedef TableOfContentsClickEvent =
{
	function preventDefault():Void;
}

typedef TableOfContentsClickHandler = TableOfContentsClickEvent->Void;
