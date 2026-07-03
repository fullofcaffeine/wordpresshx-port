package wphx.fixtures.wp.core;

import wphx.wp.admin.AdminHxxMarkupPilot;
import wphx.wp.admin.AdminHxxMarkupPilot.AdminNoticeLevel;

/**
	Executable typed-source probe for the WPHX-315.08 admin HXX markup pilot.
**/
@:keep
class AdminHxxMarkupPilotEntry
{
	static function main():Void
	{
		final notice = AdminHxxMarkupPilot.renderNotice({
			level: AdminNoticeLevel.Success,
			message: "Saved & Ready",
			dismissible: true
		});
		final row = AdminHxxMarkupPilot.renderListTableRow({
			id: 42,
			title: "Hello & World",
			editHref: "post.php?post=42&action=edit",
			classes: ["iedit", "author-self", "level-0"],
			actions: [
				{
					key: "edit",
					label: "Edit",
					href: "post.php?post=42&action=edit",
					separator: " | "
				},
				{
					key: "trash",
					label: "Trash",
					href: "post.php?post=42&action=trash&_wpnonce=abc123",
					separator: ""
				}
			]
		});

		emit("notice", notice);
		emit("row", row);
		emit("combined", notice + row);
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + encode(value));
	}

	static function encode(value:String):String
	{
		return value.split("\\").join("\\\\").split("\n").join("\\n");
	}
}
