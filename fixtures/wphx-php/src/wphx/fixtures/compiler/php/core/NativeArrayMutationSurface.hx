package wphx.fixtures.compiler.php.core;

/**
	Associative PHP-array shape used by the native array mutation core fixture.
**/
typedef NativeArrayMutationMap =
{
	var nullValue:Null<String>;
	var falseValue:Bool;
	var zeroValue:Int;
	var zeroString:String;
	var emptyString:String;
}

/**
	Probe result for falsey-preserving native array lowering.
**/
typedef NativeArrayMutationResult =
{
	final indexed:Array<Int>;
	final nested:Array<Array<Int>>;
	final nullKeyExists:Bool;
	final nullIsset:Bool;
	final nullEmpty:Bool;
	final falseReadBeforeUnset:Bool;
	final falseIssetBeforeUnset:Bool;
	final falseEmptyBeforeUnset:Bool;
	final falseKeyExistsAfterUnset:Bool;
	final zeroReadAfterWrite:Int;
	final zeroEmpty:Bool;
	final zeroStringRead:String;
	final zeroStringEmpty:Bool;
	final emptyStringEmpty:Bool;
	final missingKeyExists:Bool;
	final missingIsset:Bool;
	final missingEmpty:Bool;
	final missingFallback:String;
	final added:String;
	final appended:String;
}

/**
	Typed handles for PHP-native array constructs lowered by WPHX PHP core.
**/
class NativeArrayMutationOps
{
	public static function keyExists(array:NativeArrayMutationMap, key:String):Bool
	{
		return false;
	}

	@:wp.phpArrayIsset
	public static function issetKey(array:NativeArrayMutationMap, key:String):Bool
	{
		return false;
	}

	@:wp.phpArrayEmpty
	public static function emptyKey(array:NativeArrayMutationMap, key:String):Bool
	{
		return false;
	}

	@:wp.phpArrayGet
	public static function getString(array:NativeArrayMutationMap, key:String, fallback:String):String
	{
		return fallback;
	}

	@:wp.phpArraySet
	public static function setString(array:NativeArrayMutationMap, key:String, value:String):Void {}

	@:wp.phpArrayAppend
	public static function appendString(array:NativeArrayMutationMap, value:String):Void {}

	@:wp.phpArrayAppend
	public static function appendInt(array:Array<Int>, value:Int):Void {}

	@:wp.phpArrayUnset
	public static function unsetKey(array:NativeArrayMutationMap, key:String):Void {}
}

/**
	Minimized public shell surface for reusable native PHP array lowering.
**/
@:wp.file("wp-includes/wphx-native-array-mutation.php")
@:native("WPHX_Native_Array_Mutation")
@:wp.ifMissing
@:keep
class NativeArrayMutationSurface
{
	public static function run():NativeArrayMutationResult
	{
		final indexed = [1, 2];
		indexed[1] = 20;
		NativeArrayMutationOps.appendInt(indexed, 5);

		final nested = [[1, 2], [3, 4]];
		nested[1][0] = indexed[1] + indexed[2];

		final assoc = seed();
		final nullKeyExists = NativeArrayMutationOps.keyExists(assoc, "nullValue");
		final nullIsset = NativeArrayMutationOps.issetKey(assoc, "nullValue");
		final nullEmpty = NativeArrayMutationOps.emptyKey(assoc, "nullValue");
		final falseReadBeforeUnset = assoc.falseValue;
		final falseIssetBeforeUnset = NativeArrayMutationOps.issetKey(assoc, "falseValue");
		final falseEmptyBeforeUnset = NativeArrayMutationOps.emptyKey(assoc, "falseValue");
		final zeroEmpty = NativeArrayMutationOps.emptyKey(assoc, "zeroValue");
		final zeroStringRead = NativeArrayMutationOps.getString(assoc, "zeroString", "fallback");
		final zeroStringEmpty = NativeArrayMutationOps.emptyKey(assoc, "zeroString");
		final emptyStringEmpty = NativeArrayMutationOps.emptyKey(assoc, "emptyString");
		final missingKeyExists = NativeArrayMutationOps.keyExists(assoc, "missing");
		final missingIsset = NativeArrayMutationOps.issetKey(assoc, "missing");
		final missingEmpty = NativeArrayMutationOps.emptyKey(assoc, "missing");
		final missingFallback = NativeArrayMutationOps.getString(assoc, "missing", "fallback");

		assoc.zeroValue = assoc.zeroValue + 7;
		NativeArrayMutationOps.setString(assoc, "added", "tail");
		NativeArrayMutationOps.appendString(assoc, "loose");
		NativeArrayMutationOps.unsetKey(assoc, "falseValue");

		return {
			indexed: indexed,
			nested: nested,
			nullKeyExists: nullKeyExists,
			nullIsset: nullIsset,
			nullEmpty: nullEmpty,
			falseReadBeforeUnset: falseReadBeforeUnset,
			falseIssetBeforeUnset: falseIssetBeforeUnset,
			falseEmptyBeforeUnset: falseEmptyBeforeUnset,
			falseKeyExistsAfterUnset: NativeArrayMutationOps.keyExists(assoc, "falseValue"),
			zeroReadAfterWrite: assoc.zeroValue,
			zeroEmpty: zeroEmpty,
			zeroStringRead: zeroStringRead,
			zeroStringEmpty: zeroStringEmpty,
			emptyStringEmpty: emptyStringEmpty,
			missingKeyExists: missingKeyExists,
			missingIsset: missingIsset,
			missingEmpty: missingEmpty,
			missingFallback: missingFallback,
			added: NativeArrayMutationOps.getString(assoc, "added", "missing"),
			appended: NativeArrayMutationOps.getString(assoc, "0", "missing")
		};
	}

	static function seed():NativeArrayMutationMap
	{
		return {
			nullValue: null,
			falseValue: false,
			zeroValue: 0,
			zeroString: "0",
			emptyString: ""
		};
	}
}
