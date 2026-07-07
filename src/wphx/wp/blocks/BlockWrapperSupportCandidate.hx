package wphx.wp.blocks;

using StringTools;

/**
	Bounded WPHX-314 Haxe candidate for block wrapper support decisions.

	This module owns only deterministic wrapper attribute shaping once PHP has
	already resolved WordPress block-support inputs. Public `get_block_wrapper_attributes()`
	ABI, support registry state, theme.json values, filters, escaping, and
	installed block rendering remain PHP/WordPress-owned in this slice.
**/
@:keep
class BlockWrapperSupportCandidate
{
	public static function supportDecision(hasAnchor:Bool, hasClass:Bool, hasStyle:Bool, hasAriaLabel:Bool):String
	{
		if (hasAnchor && hasClass && hasStyle && hasAriaLabel)
		{
			return "wrapper_support_full";
		}
		if (hasStyle)
		{
			return "wrapper_support_style";
		}
		if (hasClass)
		{
			return "wrapper_support_class";
		}
		return hasAnchor ? "wrapper_support_anchor" : "wrapper_support_none";
	}

	public static function classAttribute(generatedClass:String, customClass:String, layoutClass:String):String
	{
		return joinTokens([generatedClass, customClass, layoutClass]);
	}

	public static function styleAttribute(textColor:String, backgroundColor:String, marginTop:String):String
	{
		final declarations:Array<String> = [];
		final color = textColor.trim();
		final background = backgroundColor.trim();
		final margin = marginTop.trim();
		if (color.length > 0)
		{
			declarations.push("color:" + color);
		}
		if (background.length > 0)
		{
			declarations.push("background-color:" + background);
		}
		if (margin.length > 0)
		{
			declarations.push("margin-top:" + margin);
		}
		return declarations.join(";");
	}

	public static function wrapperAttributes(anchor:String, generatedClass:String, customClass:String, layoutClass:String, textColor:String,
			backgroundColor:String, marginTop:String, ariaLabel:String):String
	{
		final attributes:Array<String> = [];
		final id = anchor.trim();
		final classes = classAttribute(generatedClass, customClass, layoutClass);
		final style = styleAttribute(textColor, backgroundColor, marginTop);
		final label = ariaLabel.trim();
		if (id.length > 0)
		{
			attributes.push('id="' + id + '"');
		}
		if (classes.length > 0)
		{
			attributes.push('class="' + classes + '"');
		}
		if (style.length > 0)
		{
			attributes.push('style="' + style + '"');
		}
		if (label.length > 0)
		{
			attributes.push('aria-label="' + label + '"');
		}
		return attributes.join(" ");
	}

	static function joinTokens(tokens:Array<String>):String
	{
		final present:Array<String> = [];
		for (token in tokens)
		{
			final trimmed = token.trim();
			if (trimmed.length > 0)
			{
				present.push(trimmed);
			}
		}
		return present.join(" ");
	}
}
