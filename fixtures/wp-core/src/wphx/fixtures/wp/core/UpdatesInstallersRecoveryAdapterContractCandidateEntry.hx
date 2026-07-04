package wphx.fixtures.wp.core;

import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.automaticUpdatePlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.coreUpdatePlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.handoffPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.installBootstrapPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.languagePackPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.networkUpdatePlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.pluginActionPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.recoveryCookiePlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.recoveryKeyPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.recoveryLinkPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.siteHealthAutomaticUpdatesPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.updateCheckPlan;
import wphx.wp.updates.UpdatesInstallersRecoveryAdapterContract.upgraderSkinPlan;

/**
	Deterministic executable probe for the WPHX-319 updates/installers/upgrader
	and recovery-mode adapter contract. The runner compares every observation
	with stable expectations.
**/
@:keep
class UpdatesInstallersRecoveryAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("update-check:disabled", updateCheckPlan(true, false, false, true));
		emit("update-check:transient", updateCheckPlan(false, true, false, true));
		emit("update-check:remote-blocked", updateCheckPlan(false, false, false, false));
		emit("update-check:force", updateCheckPlan(false, true, true, true));
		emit("update-check:remote", updateCheckPlan(false, false, false, true));

		emit("core:none", coreUpdatePlan(false, false, false, false));
		emit("core:minor", coreUpdatePlan(true, true, false, false));
		emit("core:major", coreUpdatePlan(true, false, false, false));
		emit("core:reinstall", coreUpdatePlan(false, false, true, false));
		emit("core:rollback", coreUpdatePlan(true, false, false, true));

		emit("plugin:missing-slug", pluginActionPlan("install", "", true, true, true));
		emit("plugin:capability", pluginActionPlan("install", "akismet", false, true, true));
		emit("plugin:nonce", pluginActionPlan("install", "akismet", true, false, true));
		emit("plugin:filesystem", pluginActionPlan("install", "akismet", true, true, false));
		emit("plugin:install", pluginActionPlan("install", "akismet", true, true, true));
		emit("plugin:update", pluginActionPlan("update", "akismet", true, true, true));
		emit("plugin:delete", pluginActionPlan("delete", "akismet", true, true, true));

		emit("language:no-locale", languagePackPlan("", true, false));
		emit("language:current", languagePackPlan("es_MX", false, false));
		emit("language:download", languagePackPlan("es_MX", true, false));
		emit("language:activate", languagePackPlan("es_MX", true, true));

		emit("skin:header", upgraderSkinPlan("header", false, false, false));
		emit("skin:feedback", upgraderSkinPlan("progress", false, false, false));
		emit("skin:error", upgraderSkinPlan("progress", true, false, false));
		emit("skin:bulk-footer", upgraderSkinPlan("after", false, true, false));
		emit("skin:ajax", upgraderSkinPlan("after", false, false, true));

		emit("automatic:disabled", automaticUpdatePlan(false, false, true, true, false));
		emit("automatic:lock", automaticUpdatePlan(true, true, true, true, false));
		emit("automatic:filesystem", automaticUpdatePlan(true, false, false, true, false));
		emit("automatic:core-minor", automaticUpdatePlan(true, false, true, true, false));
		emit("automatic:extension", automaticUpdatePlan(true, false, true, false, true));
		emit("automatic:ok", automaticUpdatePlan(true, false, true, false, false));
		emit("site-health:ok", siteHealthAutomaticUpdatesPlan(true, true, false));
		emit("site-health:warning", siteHealthAutomaticUpdatesPlan(true, true, true));

		emit("install:config", installBootstrapPlan(false, false, false));
		emit("install:db", installBootstrapPlan(true, false, false));
		emit("install:admin", installBootstrapPlan(true, true, false));
		emit("install:ready", installBootstrapPlan(true, true, true));

		emit("network:not-network", networkUpdatePlan(false, true, "core"));
		emit("network:capability", networkUpdatePlan(true, false, "core"));
		emit("network:core", networkUpdatePlan(true, true, "core"));
		emit("network:plugin", networkUpdatePlan(true, true, "plugin"));
		emit("network:dashboard", networkUpdatePlan(true, true, "dashboard"));

		emit("recovery-cookie:missing", recoveryCookiePlan(false, false, false));
		emit("recovery-cookie:invalid", recoveryCookiePlan(true, false, false));
		emit("recovery-cookie:expired", recoveryCookiePlan(true, true, true));
		emit("recovery-cookie:valid", recoveryCookiePlan(true, true, false));

		emit("recovery-key:missing", recoveryKeyPlan(false, false, false, false));
		emit("recovery-key:rate", recoveryKeyPlan(true, true, true, false));
		emit("recovery-key:mismatch", recoveryKeyPlan(true, false, false, false));
		emit("recovery-key:expired", recoveryKeyPlan(true, false, true, true));
		emit("recovery-key:valid", recoveryKeyPlan(true, false, true, false));

		emit("recovery-link:email", recoveryLinkPlan(false, false));
		emit("recovery-link:storage", recoveryLinkPlan(true, false));
		emit("recovery-link:ready", recoveryLinkPlan(true, true));

		emit("handoff:auth", handoffPlan("capability nonce recovery cookie"));
		emit("handoff:http", handoffPlan("http cron mail"));
		emit("handoff:filesystem", handoffPlan("filesystem package upload"));
		emit("handoff:admin", handoffPlan("admin notice list-table"));
		emit("handoff:multisite", handoffPlan("network multisite wrapper"));
		emit("handoff:theme", handoffPlan("theme updater"));
		emit("handoff:vendor", handoffPlan("vendor library"));
		emit("handoff:unknown", handoffPlan("unknown"));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
