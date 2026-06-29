package wphx.wp.blocks;

using StringTools;

/**
	Typed WPHX-314 blocks/interactivity adapter contract decisions.

	This module models narrow branch choices that WordPress exposes through block
	parsing, registration, rendering, supports, bindings, hooked blocks, patterns,
	style engine output, HTML API processing, fonts/assets, and interactivity
	directives. It is not a public PHP implementation and does not own editor
	packages, browser behavior, installed distribution routing, or original-path
	PHP adapter emission.
**/
@:keep
final PARSER_EMPTY = "block_parser_empty";

@:keep
final PARSER_FREEFORM = "block_parser_freeform";

@:keep
final PARSER_NESTED_BLOCKS = "block_parser_nested_blocks";

@:keep
final PARSER_MALFORMED_COMMENT = "block_parser_malformed_comment";

@:keep
final PARSER_SERIALIZED_BLOCK = "block_parser_serialized_block";

@:keep
final RENDER_UNREGISTERED = "block_render_unregistered";

@:keep
final RENDER_STATIC = "block_render_static";

@:keep
final RENDER_DYNAMIC_CALLBACK = "block_render_dynamic_callback";

@:keep
final RENDER_REUSABLE = "block_render_reusable";

@:keep
final RENDER_CONTEXTUAL = "block_render_contextual";

@:keep
final SUPPORT_NONE = "block_support_none";

@:keep
final SUPPORT_LAYOUT = "block_support_layout";

@:keep
final SUPPORT_STYLE_ATTRIBUTE = "block_support_style_attribute";

@:keep
final SUPPORT_CLASS_ATTRIBUTE = "block_support_class_attribute";

@:keep
final SUPPORT_FULL_WRAPPER = "block_support_full_wrapper";

@:keep
final BINDING_SOURCE_MISSING = "block_binding_source_missing";

@:keep
final BINDING_ATTRIBUTE_UNBOUND = "block_binding_attribute_unbound";

@:keep
final BINDING_CONTEXT_MISSING = "block_binding_context_missing";

@:keep
final BINDING_PATTERN_OVERRIDE = "block_binding_pattern_override";

@:keep
final BINDING_RESOLVED = "block_binding_resolved";

@:keep
final HOOK_INSERT_NONE = "block_hook_insert_none";

@:keep
final HOOK_INSERT_IGNORED = "block_hook_insert_ignored";

@:keep
final HOOK_INSERT_FIRST_CHILD = "block_hook_insert_first_child";

@:keep
final HOOK_INSERT_RELATIVE = "block_hook_insert_relative";

@:keep
final PATTERN_UNREGISTERED = "block_pattern_unregistered";

@:keep
final PATTERN_CATEGORY_ONLY = "block_pattern_category_only";

@:keep
final PATTERN_THEME = "block_pattern_theme";

@:keep
final PATTERN_REMOTE = "block_pattern_remote";

@:keep
final STYLE_EMPTY = "style_engine_empty";

@:keep
final STYLE_DECLARATIONS_ONLY = "style_engine_declarations_only";

@:keep
final STYLE_SELECTOR_RULE = "style_engine_selector_rule";

@:keep
final STYLE_STORED_MERGE = "style_engine_stored_merge";

@:keep
final HTML_UNSUPPORTED = "html_api_unsupported";

@:keep
final HTML_TAG_ONLY = "html_api_tag_only";

@:keep
final HTML_ATTRIBUTE_MUTATION = "html_api_attribute_mutation";

@:keep
final HTML_TEXT_REPLACEMENT = "html_api_text_replacement";

@:keep
final INTERACTIVITY_DISABLED = "interactivity_disabled";

@:keep
final INTERACTIVITY_STORE_ONLY = "interactivity_store_only";

@:keep
final INTERACTIVITY_DIRECTIVES = "interactivity_directives";

@:keep
final INTERACTIVITY_HYDRATION = "interactivity_hydration";

@:keep
final FONT_NONE = "font_asset_none";

@:keep
final FONT_COLLECTION = "font_asset_collection";

@:keep
final FONT_FACE = "font_asset_face";

@:keep
final FONT_ADMIN_ASSET = "font_asset_admin";

@:keep
final HOOK_NONE = "block_no_hooks";

@:keep
final HOOK_RENDER = "block_render_hooks";

@:keep
final HOOK_SUPPORTS = "block_support_hooks";

@:keep
final HOOK_BINDINGS = "block_binding_hooks";

@:keep
final HOOK_PATTERNS = "block_pattern_hooks";

@:keep
final HOOK_INTERACTIVITY = "block_interactivity_hooks";

/**
	Chooses the parser branch before PHP owns token offsets and parsed tree
	materialization.
**/
@:keep
function parserPlan(hasSerializedBlock:Bool, malformedComment:Bool, hasInnerBlocks:Bool, preserveFreeform:Bool):String
{
	if (malformedComment)
	{
		return PARSER_MALFORMED_COMMENT;
	}
	if (hasInnerBlocks)
	{
		return PARSER_NESTED_BLOCKS;
	}
	if (hasSerializedBlock)
	{
		return PARSER_SERIALIZED_BLOCK;
	}
	return preserveFreeform ? PARSER_FREEFORM : PARSER_EMPTY;
}

/**
	Models the public render branch without executing callbacks, queries, or
	template includes.
**/
@:keep
function renderPlan(registered:Bool, dynamicBlock:Bool, callbackAvailable:Bool, reusableBlock:Bool, needsContext:Bool):String
{
	if (!registered)
	{
		return RENDER_UNREGISTERED;
	}
	if (reusableBlock)
	{
		return RENDER_REUSABLE;
	}
	if (needsContext)
	{
		return RENDER_CONTEXTUAL;
	}
	if (dynamicBlock && callbackAvailable)
	{
		return RENDER_DYNAMIC_CALLBACK;
	}
	return RENDER_STATIC;
}

/**
	Models wrapper support output intent while PHP owns concrete attribute
	serialization and theme.json values.
**/
@:keep
function supportPlan(layout:Bool, styleAttribute:Bool, classAttribute:Bool, allSupports:Bool):String
{
	if (allSupports)
	{
		return SUPPORT_FULL_WRAPPER;
	}
	if (styleAttribute)
	{
		return SUPPORT_STYLE_ATTRIBUTE;
	}
	if (classAttribute)
	{
		return SUPPORT_CLASS_ATTRIBUTE;
	}
	return layout ? SUPPORT_LAYOUT : SUPPORT_NONE;
}

/**
	Chooses the block binding branch before source callbacks read posts, terms,
	pattern overrides, or context values.
**/
@:keep
function bindingPlan(sourceRegistered:Bool, attributeBound:Bool, contextAvailable:Bool, patternOverride:Bool):String
{
	if (!sourceRegistered)
	{
		return BINDING_SOURCE_MISSING;
	}
	if (!attributeBound)
	{
		return BINDING_ATTRIBUTE_UNBOUND;
	}
	if (patternOverride)
	{
		return BINDING_PATTERN_OVERRIDE;
	}
	return contextAvailable ? BINDING_RESOLVED : BINDING_CONTEXT_MISSING;
}

/**
	Models hooked-block insertion intent before PHP mutates block trees or ignored
	hooked-block metadata.
**/
@:keep
function hookedBlockPlan(hasHookedBlock:Bool, ignored:Bool, firstChild:Bool, relativePosition:Bool):String
{
	if (!hasHookedBlock)
	{
		return HOOK_INSERT_NONE;
	}
	if (ignored)
	{
		return HOOK_INSERT_IGNORED;
	}
	if (firstChild)
	{
		return HOOK_INSERT_FIRST_CHILD;
	}
	return relativePosition ? HOOK_INSERT_RELATIVE : HOOK_INSERT_NONE;
}

/**
	Routes block pattern intent while registration stores and remote fetches stay
	PHP/provider behavior.
**/
@:keep
function patternPlan(patternRegistered:Bool, categoryRegistered:Bool, themeProvided:Bool, remotePattern:Bool):String
{
	if (remotePattern)
	{
		return PATTERN_REMOTE;
	}
	if (themeProvided)
	{
		return PATTERN_THEME;
	}
	if (patternRegistered)
	{
		return categoryRegistered ? PATTERN_CATEGORY_ONLY : PATTERN_UNREGISTERED;
	}
	return PATTERN_UNREGISTERED;
}

/**
	Models style-engine output shape before CSS rules are printed or stored.
**/
@:keep
function styleEnginePlan(hasDeclarations:Bool, hasSelector:Bool, storeRule:Bool, mergeWithExisting:Bool):String
{
	if (!hasDeclarations)
	{
		return STYLE_EMPTY;
	}
	if (storeRule && mergeWithExisting)
	{
		return STYLE_STORED_MERGE;
	}
	return hasSelector ? STYLE_SELECTOR_RULE : STYLE_DECLARATIONS_ONLY;
}

/**
	Chooses the HTML API mutation branch while tokenization and browser-specific
	HTML semantics remain PHP-owned.
**/
@:keep
function htmlApiPlan(validTag:Bool, mutateAttribute:Bool, replaceText:Bool, unsupportedMarkup:Bool):String
{
	if (unsupportedMarkup || !validTag)
	{
		return HTML_UNSUPPORTED;
	}
	if (replaceText)
	{
		return HTML_TEXT_REPLACEMENT;
	}
	return mutateAttribute ? HTML_ATTRIBUTE_MUTATION : HTML_TAG_ONLY;
}

/**
	Models interactivity API output intent before directive processors and
	hydration data mutate HTML.
**/
@:keep
function interactivityPlan(storeRegistered:Bool, directivesPresent:Bool, serverStatePresent:Bool):String
{
	if (!storeRegistered)
	{
		return INTERACTIVITY_DISABLED;
	}
	if (serverStatePresent)
	{
		return INTERACTIVITY_HYDRATION;
	}
	return directivesPresent ? INTERACTIVITY_DIRECTIVES : INTERACTIVITY_STORE_ONLY;
}

/**
	Names font and block asset branches without reading build manifests or
	admin-route packages.
**/
@:keep
function fontAssetPlan(collectionRegistered:Bool, faceRegistered:Bool, adminAsset:Bool):String
{
	if (adminAsset)
	{
		return FONT_ADMIN_ASSET;
	}
	if (faceRegistered)
	{
		return FONT_FACE;
	}
	return collectionRegistered ? FONT_COLLECTION : FONT_NONE;
}

/**
	Names hook families expected around block and interactivity operations.
**/
@:keep
function hookPlan(operation:String, succeeded:Bool):String
{
	if (!succeeded)
	{
		return HOOK_NONE;
	}
	return switch operation.trim().toLowerCase()
	{
		case "render" | "render_block" | "pre_render_block":
			HOOK_RENDER;
		case "supports" | "render_block_data" | "block_wrapper_attributes":
			HOOK_SUPPORTS;
		case "bindings" | "block_bindings" | "block_bindings_source_value":
			HOOK_BINDINGS;
		case "patterns" | "block_patterns" | "register_block_pattern":
			HOOK_PATTERNS;
		case "interactivity" | "wp_interactivity_state" | "directive":
			HOOK_INTERACTIVITY;
		case _:
			HOOK_NONE;
	}
}
