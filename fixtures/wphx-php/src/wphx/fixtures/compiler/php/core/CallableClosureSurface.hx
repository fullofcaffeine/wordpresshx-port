package wphx.fixtures.compiler.php.core;

/**
	Reference-sensitive payload passed through a PHP callable dispatch array.
**/
typedef CallableClosurePayload =
{
	var count:Int;
	var label:String;
}

/**
	Probe result for reusable callable and closure lowering.
**/
typedef CallableClosureResult =
{
	final closureResult:String;
	final staticCallableResult:String;
	final acceptedArgsResult:String;
	final mutationReturn:String;
	final payloadCount:Int;
	final payloadLabel:String;
}

/**
	Typed handles for PHP-native callable constructs lowered by WPHX PHP core.
**/
class CallableClosureOps
{
	@:wp.phpCallableArray
	public static function staticCallable(className:String, method:String):Array<String>
	{
		return [];
	}

	@:wp.phpCallUserFunc
	public static function callClosure2(callback:(String, String) -> String, left:String, right:String):String
	{
		return "";
	}

	@:wp.phpCallUserFunc
	public static function callStatic2(callback:Array<String>, left:String, right:String):String
	{
		return "";
	}

	@:wp.phpCallUserFuncArray
	public static function callStaticArray(callback:Array<String>, args:Array<String>):String
	{
		return "";
	}

	@:wp.phpCallUserFuncArray
	public static function callPayloadArray(callback:Array<String>, args:Array<CallableClosurePayload>):String
	{
		return "";
	}

	@:wp.phpAcceptedArgs
	public static function acceptedArgs(args:Array<String>, accepted:Int):Array<String>
	{
		return [];
	}

	@:wp.phpReferenceArray
	public static function referenceArgs(payload:CallableClosurePayload):Array<CallableClosurePayload>
	{
		return [];
	}
}

/**
	Minimized public shell surface for reusable PHP callable/closure lowering.
**/
@:wp.file("wp-includes/wphx-callable-closure.php")
@:native("WPHX_Callable_Closure")
@:wp.ifMissing
@:keep
class CallableClosureSurface
{
	public static function run():CallableClosureResult
	{
		final joiner = function(left:String, right:String):String
		{
			return left + ":" + right;
		};
		final closureResult = CallableClosureOps.callClosure2(joiner, "core", "closure");
		final staticCallable = CallableClosureOps.staticCallable("WPHX_Callable_Closure", "joinStatic");
		final staticCallableResult = CallableClosureOps.callStatic2(staticCallable, "array", "callable");
		final args = ["first", "second", "ignored"];
		final accepted = CallableClosureOps.acceptedArgs(args, 2);
		final acceptedArgsResult = CallableClosureOps.callStaticArray(staticCallable, accepted);
		final payload = {
			count: 2,
			label: "ref"
		};
		final mutationReturn = CallableClosureOps.callPayloadArray(CallableClosureOps.staticCallable("WPHX_Callable_Closure", "mutatePayload"),
			CallableClosureOps.referenceArgs(payload));

		return {
			closureResult: closureResult,
			staticCallableResult: staticCallableResult,
			acceptedArgsResult: acceptedArgsResult,
			mutationReturn: mutationReturn,
			payloadCount: payload.count,
			payloadLabel: payload.label
		};
	}

	public static function joinStatic(left:String, right:String):String
	{
		return left + "-" + right;
	}

	public static function mutatePayload(@:wp.byRef payload:CallableClosurePayload):String
	{
		payload.count += 4;
		payload.label = payload.label + ":" + payload.count;
		return payload.label;
	}
}
