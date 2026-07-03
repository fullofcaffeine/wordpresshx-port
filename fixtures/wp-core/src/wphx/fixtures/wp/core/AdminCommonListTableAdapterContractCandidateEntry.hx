package wphx.fixtures.wp.core;

import wphx.wp.admin.AdminCommonListTableAdapterContract.adminGuardPlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.adminNoticePlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.adminRequestPlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.listTablePlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.menuRegistrationPlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.outputFragmentPlan;
import wphx.wp.admin.AdminCommonListTableAdapterContract.screenSetupPlan;

/**
	Deterministic executable probe for the WPHX-315 admin common/list-table
	adapter contract. The runner compares every line with stable expectations
	before writing manifests or receipts.
**/
@:keep
class AdminCommonListTableAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("request:denied", adminRequestPlan(false, false, false, false, false));
		emit("request:network", adminRequestPlan(true, true, false, false, true));
		emit("request:user", adminRequestPlan(true, false, true, false, true));
		emit("request:action", adminRequestPlan(true, false, false, true, true));
		emit("request:screen", adminRequestPlan(true, false, false, false, true));
		emit("request:dashboard", adminRequestPlan(true, false, false, false, false));

		emit("screen:missing", screenSetupPlan("", false, false, false, false));
		emit("screen:list-table", screenSetupPlan("users", true, true, true, true));
		emit("screen:options", screenSetupPlan("dashboard", true, true, true, false));
		emit("screen:help", screenSetupPlan("plugins", true, true, false, false));
		emit("screen:current", screenSetupPlan("tools", true, false, false, false));

		emit("table:empty", listTablePlan(false, false, "", false, 1, 1, 0));
		emit("table:bulk", listTablePlan(true, false, "delete", false, 1, 1, 0));
		emit("table:row", listTablePlan(true, false, "-1", true, 1, 1, 0));
		emit("table:page", listTablePlan(true, false, "-1", false, 7, 3, 0));
		emit("table:hidden", listTablePlan(true, false, "-1", false, 1, 3, 2));
		emit("table:search", listTablePlan(true, true, "-1", false, 1, 3, 0));
		emit("table:display", listTablePlan(true, false, "-1", false, 1, 3, 0));

		emit("menu:capability", menuRegistrationPlan(false, "", false, false, false));
		emit("menu:duplicate", menuRegistrationPlan(true, "", false, true, false));
		emit("menu:orphan", menuRegistrationPlan(true, "", true, false, false));
		emit("menu:submenu", menuRegistrationPlan(true, "tools.php", true, false, false));
		emit("menu:reorder", menuRegistrationPlan(true, "", false, false, true));
		emit("menu:top", menuRegistrationPlan(true, "", false, false, false));

		emit("notice:suppressed", adminNoticePlan("info", false, false, false, true));
		emit("notice:stored", adminNoticePlan("warning", true, false, true, true));
		emit("notice:dismissible", adminNoticePlan("success", true, true, false, true));
		emit("notice:escaped", adminNoticePlan("error", true, false, false, false));
		emit("notice:success", adminNoticePlan("success", true, false, false, true));
		emit("notice:warning", adminNoticePlan("warning", true, false, false, true));
		emit("notice:error", adminNoticePlan("error", true, false, false, true));
		emit("notice:info", adminNoticePlan("unknown", true, false, false, true));

		emit("guard:capability", adminGuardPlan(false, true, true, true));
		emit("guard:nonce-missing", adminGuardPlan(true, false, false, true));
		emit("guard:nonce-failed", adminGuardPlan(true, true, false, true));
		emit("guard:hook", adminGuardPlan(true, true, true, false));
		emit("guard:ready", adminGuardPlan(true, true, true, true));

		emit("output:header", outputFragmentPlan(false, 0, false, false));
		emit("output:notices", outputFragmentPlan(true, 2, true, true));
		emit("output:list-table", outputFragmentPlan(true, 0, true, true));
		emit("output:footer", outputFragmentPlan(true, 0, false, true));
		emit("output:complete", outputFragmentPlan(true, 0, false, false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
