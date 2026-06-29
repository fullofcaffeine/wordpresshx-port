package wphx.compiler.php;

#if macro
import reflaxe.BaseCompiler.BaseCompilerFileOutputType;
import reflaxe.ReflectCompiler;
#end

/**
	Registers the in-repo WordPressHX PHP emitter for `-D wphx_php_output` builds.
**/
class CompilerInit
{
	#if macro
	static var initialized:Bool = false;

	public static function Start():Void
	{
		if (!haxe.macro.Context.defined("wphx_php_output"))
		{
			return;
		}

		if (initialized)
		{
			return;
		}
		initialized = true;

		ReflectCompiler.Start();
		ReflectCompiler.AddCompiler(new WphxPhpCompiler(), {
			outputDirDefineName: "wphx_php_output",
			fileOutputType: Manual,
			fileOutputExtension: ".php",
			targetCodeInjectionName: "__wphx_php__",
			ignoreBodilessFunctions: false,
			ignoreExterns: true,
			expressionPreprocessors: []
		});
	}
	#else
	public static function Start():Void {}
	#end
}
