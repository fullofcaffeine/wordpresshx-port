package wphx.fixtures.wp.core;

import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.authGuardPlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.boundaryPlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.deprecatedSurfacePlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.endpointPlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.handoffPlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.ixrEnvelopePlan;
import wphx.wp.xmlrpc.XmlRpcLegacyAdapterContract.methodFamilyPlan;

/**
	Deterministic executable probe for the WPHX-318 XML-RPC, legacy, and
	deprecated API adapter contract. The runner compares every observation with
	stable expectations.
**/
@:keep
class XmlRpcLegacyAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("endpoint:disabled", endpointPlan(false, "POST", true));
		emit("endpoint:get", endpointPlan(true, "GET", true));
		emit("endpoint:missing-body", endpointPlan(true, "POST", false));
		emit("endpoint:dispatch", endpointPlan(true, "POST", true));

		emit("method:system", methodFamilyPlan("system.listMethods"));
		emit("method:demo", methodFamilyPlan("demo.addTwoNumbers"));
		emit("method:wp", methodFamilyPlan("wp.getPosts"));
		emit("method:blogger", methodFamilyPlan("blogger.getUsersBlogs"));
		emit("method:mw", methodFamilyPlan("metaWeblog.newPost"));
		emit("method:mt", methodFamilyPlan("mt.getRecentPostTitles"));
		emit("method:pingback", methodFamilyPlan("pingback.ping"));
		emit("method:unknown", methodFamilyPlan("custom.method"));

		emit("guard:public", authGuardPlan("system.listMethods", false, false, true, false, false, false));
		emit("guard:min-args", authGuardPlan("wp.getPosts", true, true, false, true, true, true));
		emit("guard:missing-credentials", authGuardPlan("wp.getPosts", false, false, true, true, true, true));
		emit("guard:auth-failed", authGuardPlan("wp.getPosts", true, false, true, true, true, true));
		emit("guard:content-cap", authGuardPlan("wp.editPost", true, true, true, false, true, true));
		emit("guard:media-cap", authGuardPlan("wp.uploadFile", true, true, true, true, false, true));
		emit("guard:options-cap", authGuardPlan("wp.setOptions", true, true, true, true, true, false));
		emit("guard:ready", authGuardPlan("wp.getPosts", true, true, true, true, true, true));

		emit("ixr:missing-xml", ixrEnvelopePlan(false, false, false, false, false));
		emit("ixr:parse-fault", ixrEnvelopePlan(true, false, false, false, false));
		emit("ixr:missing-method", ixrEnvelopePlan(true, true, false, false, false));
		emit("ixr:method-call", ixrEnvelopePlan(true, true, true, false, false));
		emit("ixr:fault-response", ixrEnvelopePlan(true, true, true, true, true));
		emit("ixr:success-response", ixrEnvelopePlan(true, true, true, false, true));

		emit("deprecated:function", deprecatedSurfacePlan("get_alloptions"));
		emit("deprecated:file", deprecatedSurfacePlan("wp-includes/deprecated.php"));
		emit("deprecated:legacy-compat", deprecatedSurfacePlan("IXR_Message"));
		emit("deprecated:unknown", deprecatedSurfacePlan("modern_symbol"));

		emit("boundary:entrypoint", boundaryPlan("xmlrpc.php"));
		emit("boundary:server", boundaryPlan("wp-includes/class-wp-xmlrpc-server.php"));
		emit("boundary:deprecated", boundaryPlan("wp-includes/deprecated.php"));
		emit("boundary:ixr", boundaryPlan("wp-includes/IXR/class-IXR-base64.php"));
		emit("boundary:akismet", boundaryPlan("wp-content/plugins/akismet/class.akismet.php"));
		emit("boundary:hello", boundaryPlan("wp-content/plugins/hello.php"));
		emit("boundary:plugin-guard", boundaryPlan("wp-content/plugins/index.php"));
		emit("boundary:unknown", boundaryPlan("wp-includes/functions.php"));

		emit("handoff:auth", handoffPlan("wp.getProfile"));
		emit("handoff:posts", handoffPlan("metaWeblog.newPost"));
		emit("handoff:taxonomy-comments", handoffPlan("wp.editComment"));
		emit("handoff:media", handoffPlan("wp.uploadFile"));
		emit("handoff:http-pingback", handoffPlan("pingback.ping"));
		emit("handoff:multisite", handoffPlan("wp.getUsersBlogs"));
		emit("handoff:deprecated", handoffPlan("deprecated.get_links"));
		emit("handoff:unknown", handoffPlan("custom.method"));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
