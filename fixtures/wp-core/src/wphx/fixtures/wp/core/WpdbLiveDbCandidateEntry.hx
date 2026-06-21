package wphx.fixtures.wp.core;

import wphx.wp.db.LiveDbSchema;

class WpdbLiveDbCandidateEntry
{
	static function main():Void
	{
		LiveDbSchema.tableExists("wp_options", "wp_options");
		LiveDbSchema.shouldIssueCreate(false);
		LiveDbSchema.columnMatches("option_name", "option_name");
		LiveDbSchema.shouldIssueAlter(false);
	}
}
