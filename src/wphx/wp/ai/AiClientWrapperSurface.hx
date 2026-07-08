package wphx.wp.ai;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Original-path WordPress AI client wrapper functions over preserved php-ai-client internals.
**/
@:wp.file("wp-includes/ai-client.php")
@:wp.global("wp_supports_ai")
@:wp.returnType("bool")
@:keep
function wpSupportsAi():Bool
{
	if (AiClientPhp.defined("WP_AI_SUPPORT") && AiClientPhp.boolValue(AiClientPhp.constantValue("WP_AI_SUPPORT")) == false)
	{
		return false;
	}
	return AiClientPhp.boolValue(AiClientPhp.applyFilters("wp_supports_ai", true));
}

/**
	Constructs the public prompt builder while leaving prompt payload typing at the WordPress PHP boundary.
**/
@:wp.file("wp-includes/ai-client.php")
@:wp.global("wp_ai_client_prompt")
@:wp.returnType("WP_AI_Client_Prompt_Builder")
@:keep
function wpAiClientPrompt(prompt:NativeValue = null):WordPressAiClientPromptBuilder
{
	return new WordPressAiClientPromptBuilder(PhpAiClient.defaultRegistry(), prompt);
}

/**
	Narrow PHP global-function lowerings required by the generated AI wrapper adapter.
**/
private class AiClientPhp
{
	@:wp.phpFunction("defined")
	public static function defined(name:String):Bool
	{
		return false;
	}

	@:wp.phpFunction("constant")
	public static function constantValue(name:String):NativeValue
	{
		return null;
	}

	@:wp.phpFunction("boolval")
	public static function boolValue(value:NativeValue):Bool
	{
		return false;
	}

	@:wp.phpFunction("apply_filters")
	public static function applyFilters(hookName:String, value:NativeValue):NativeValue
	{
		return value;
	}
}

/**
	Preserved bundled php-ai-client registry entry used by the WordPress wrapper.
**/
@:native("\\WordPress\\AiClient\\AiClient")
extern class PhpAiClient
{
	public static function defaultRegistry():NativeValue;
}

/**
	Existing WordPress prompt builder class constructed by the generated wrapper.
**/
@:native("WP_AI_Client_Prompt_Builder")
extern class WordPressAiClientPromptBuilder
{
	public function new(registry:NativeValue, prompt:NativeValue);
}
