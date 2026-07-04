package wphx.fixtures.wp.core;

import wphx.wp.admin.AdminFeatureAjaxAdapterContract.adminPostActionPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.ajaxActionPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.ajaxResponsePlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.contentFeatureActionPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.featureGuardPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.networkAdminPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.privacyActionPlan;
import wphx.wp.admin.AdminFeatureAjaxAdapterContract.settingsScreenPlan;

/**
	Deterministic executable probe for the WPHX-316 admin feature/AJAX adapter
	contract. The runner compares every observation with stable expectations.
**/
@:keep
class AdminFeatureAjaxAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("ajax:missing", ajaxActionPlan("", true, true, false, false, false));
		emit("ajax:heartbeat", ajaxActionPlan("heartbeat", true, true, false, false, false));
		emit("ajax:media", ajaxActionPlan("query-attachments", true, true, false, true, false));
		emit("ajax:privileged", ajaxActionPlan("inline-save", true, true, false, false, false));
		emit("ajax:nopriv", ajaxActionPlan("logged-out-test", false, false, true, false, false));
		emit("ajax:destructive", ajaxActionPlan("delete-comment", true, true, false, false, true));
		emit("ajax:denied", ajaxActionPlan("unknown-action", false, false, false, false, false));

		emit("post:missing", adminPostActionPlan("", "POST", true, true, false));
		emit("post:capability", adminPostActionPlan("save", "POST", false, true, false));
		emit("post:method", adminPostActionPlan("save", "GET", true, true, false));
		emit("post:handler", adminPostActionPlan("save", "POST", true, false, false));
		emit("post:redirect", adminPostActionPlan("save", "POST", true, true, true));
		emit("post:dispatch", adminPostActionPlan("save", "POST", true, true, false));

		emit("guard:capability", featureGuardPlan(false, true, true, true, false));
		emit("guard:nonce-missing", featureGuardPlan(true, true, false, false, false));
		emit("guard:nonce-failed", featureGuardPlan(true, true, true, false, false));
		emit("guard:locked", featureGuardPlan(true, false, false, false, true));
		emit("guard:ready", featureGuardPlan(true, true, true, true, false));

		emit("response:error", ajaxResponsePlan(true, false, true, false, false));
		emit("response:validation", ajaxResponsePlan(true, false, false, true, false));
		emit("response:json", ajaxResponsePlan(true, false, false, false, false));
		emit("response:xml", ajaxResponsePlan(false, true, false, false, false));
		emit("response:no-content", ajaxResponsePlan(false, false, false, false, true));
		emit("response:html", ajaxResponsePlan(false, false, false, false, false));

		emit("settings:capability", settingsScreenPlan("general", "POST", false, true, false));
		emit("settings:network", settingsScreenPlan("network", "POST", true, true, true));
		emit("settings:render", settingsScreenPlan("reading", "GET", true, false, false));
		emit("settings:save", settingsScreenPlan("writing", "POST", true, true, false));
		emit("settings:idle", settingsScreenPlan("", "GET", true, false, false));

		emit("content:missing", contentFeatureActionPlan("post", "edit", false, false, false));
		emit("content:autosave", contentFeatureActionPlan("post", "edit", true, true, false));
		emit("content:bulk", contentFeatureActionPlan("post", "bulk", true, false, true));
		emit("content:post", contentFeatureActionPlan("post", "edit", true, false, false));
		emit("content:term", contentFeatureActionPlan("term", "edit", true, false, false));
		emit("content:comment", contentFeatureActionPlan("comment", "reply", true, false, false));
		emit("content:unknown", contentFeatureActionPlan("link", "edit", true, false, false));

		emit("privacy:missing", privacyActionPlan("export", false, false, false));
		emit("privacy:ajax-export", privacyActionPlan("export", true, true, false));
		emit("privacy:ajax-erase", privacyActionPlan("erase", true, true, false));
		emit("privacy:email", privacyActionPlan("export", false, true, true));
		emit("privacy:export", privacyActionPlan("export", false, true, false));
		emit("privacy:erase", privacyActionPlan("erase", false, true, false));
		emit("privacy:overview", privacyActionPlan("overview", false, true, false));

		emit("network:not-network", networkAdminPlan(false, true, false, false, false));
		emit("network:capability", networkAdminPlan(true, false, false, false, false));
		emit("network:site", networkAdminPlan(true, true, true, false, false));
		emit("network:user", networkAdminPlan(true, true, false, true, false));
		emit("network:action", networkAdminPlan(true, true, false, false, true));
		emit("network:dashboard", networkAdminPlan(true, true, false, false, false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
