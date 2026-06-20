package wphx.fixtures.php.facade;

@:keep
class TemplateKernel
{
	public static function marker(name:String):String
	{
		return "template:" + name.toUpperCase();
	}

	public static function notice(value:String):String
	{
		return value.toUpperCase();
	}

	public static function rowClass(index:Int):String
	{
		return index % 2 == 0 ? "row even" : "row odd";
	}

	public static function metaLine(author:String, date:String):String
	{
		return "By " + author + " on " + date;
	}

	public static function excerpt(content:String, limit:Int):String
	{
		return content.length <= limit ? content : content.substr(0, limit) + "...";
	}
}
