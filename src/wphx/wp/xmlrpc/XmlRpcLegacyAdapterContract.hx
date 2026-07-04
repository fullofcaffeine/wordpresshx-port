package wphx.wp.xmlrpc;

using StringTools;

/**
	Typed WPHX-318 XML-RPC, legacy, and deprecated API adapter-contract
	decisions.

	This module models narrow intent for endpoint admission, XML-RPC method
	families, auth/capability guards, IXR payload/envelope handoff, deprecated
	surface classification, bundled plugin/library boundaries, and cross-domain
	ownership handoffs. It is fixture evidence only; public `xmlrpc.php`
	replacement, `wp_xmlrpc_server` runtime ownership, IXR serialization, bundled
	plugin implementation, database-backed behavior, and installed route parity
	remain later gates.
**/
enum XmlRpcMethodFamily
{
	SystemFamily;
	DemoFamily;
	WordPressFamily;
	BloggerFamily;
	MetaWeblogFamily;
	MovableTypeFamily;
	PingbackFamily;
	UnknownFamily;
}

/**
	Endpoint admission states before WordPress bootstrap, headers, and IXR
	dispatch execute in public PHP.
**/
enum XmlRpcEndpointState
{
	EndpointDisabled;
	EndpointRejectNonPost;
	EndpointMissingBody;
	EndpointDispatch;
}

/**
	IXR request and response handoff states preserved as a compatibility boundary
	until the XML parser, serializer, and fault classes have dedicated evidence.
**/
enum IxrEnvelopeState
{
	IxrMissingXml;
	IxrParseFault;
	IxrMissingMethod;
	IxrMethodCall;
	IxrFaultResponse;
	IxrSuccessResponse;
}

/**
	Deprecated/bundled/preserved source boundaries that WPHX-318 must keep
	distinct while ownership moves from inventory to generated adapters.
**/
enum LegacyBoundary
{
	CoreDeprecatedApi;
	XmlRpcEntrypoint;
	XmlRpcServer;
	PreservedIxrLibrary;
	BundledAkismetDistribution;
	BundledHelloPlugin;
	PluginDirectoryGuard;
	UnknownLegacyBoundary;
}

@:keep
final XMLRPC_ENDPOINT_DISABLED = "xmlrpc_endpoint_disabled";

@:keep
final XMLRPC_ENDPOINT_REJECT_NON_POST = "xmlrpc_endpoint_reject_non_post";

@:keep
final XMLRPC_ENDPOINT_MISSING_BODY = "xmlrpc_endpoint_missing_body";

@:keep
final XMLRPC_ENDPOINT_DISPATCH = "xmlrpc_endpoint_dispatch";

@:keep
final XMLRPC_METHOD_SYSTEM = "xmlrpc_method_system";

@:keep
final XMLRPC_METHOD_DEMO = "xmlrpc_method_demo";

@:keep
final XMLRPC_METHOD_WORDPRESS = "xmlrpc_method_wordpress";

@:keep
final XMLRPC_METHOD_BLOGGER = "xmlrpc_method_blogger";

@:keep
final XMLRPC_METHOD_META_WEBLOG = "xmlrpc_method_meta_weblog";

@:keep
final XMLRPC_METHOD_MOVABLE_TYPE = "xmlrpc_method_movable_type";

@:keep
final XMLRPC_METHOD_PINGBACK = "xmlrpc_method_pingback";

@:keep
final XMLRPC_METHOD_UNKNOWN = "xmlrpc_method_unknown";

@:keep
final XMLRPC_GUARD_PUBLIC_METHOD = "xmlrpc_guard_public_method";

@:keep
final XMLRPC_GUARD_MINIMUM_ARGS_FAILED = "xmlrpc_guard_minimum_args_failed";

@:keep
final XMLRPC_GUARD_CREDENTIALS_MISSING = "xmlrpc_guard_credentials_missing";

@:keep
final XMLRPC_GUARD_AUTH_FAILED = "xmlrpc_guard_auth_failed";

@:keep
final XMLRPC_GUARD_CONTENT_CAPABILITY_DENIED = "xmlrpc_guard_content_capability_denied";

@:keep
final XMLRPC_GUARD_MEDIA_CAPABILITY_DENIED = "xmlrpc_guard_media_capability_denied";

@:keep
final XMLRPC_GUARD_OPTIONS_CAPABILITY_DENIED = "xmlrpc_guard_options_capability_denied";

@:keep
final XMLRPC_GUARD_READY = "xmlrpc_guard_ready";

@:keep
final XMLRPC_IXR_MISSING_XML = "xmlrpc_ixr_missing_xml";

@:keep
final XMLRPC_IXR_PARSE_FAULT = "xmlrpc_ixr_parse_fault";

@:keep
final XMLRPC_IXR_MISSING_METHOD = "xmlrpc_ixr_missing_method";

@:keep
final XMLRPC_IXR_METHOD_CALL = "xmlrpc_ixr_method_call";

@:keep
final XMLRPC_IXR_FAULT_RESPONSE = "xmlrpc_ixr_fault_response";

@:keep
final XMLRPC_IXR_SUCCESS_RESPONSE = "xmlrpc_ixr_success_response";

@:keep
final XMLRPC_DEPRECATED_FUNCTION = "xmlrpc_deprecated_function";

@:keep
final XMLRPC_DEPRECATED_FILE = "xmlrpc_deprecated_file";

@:keep
final XMLRPC_LEGACY_COMPAT_FUNCTION = "xmlrpc_legacy_compat_function";

@:keep
final XMLRPC_DEPRECATED_UNKNOWN = "xmlrpc_deprecated_unknown";

@:keep
final XMLRPC_BOUNDARY_DEPRECATED_API = "xmlrpc_boundary_deprecated_api";

@:keep
final XMLRPC_BOUNDARY_ENTRYPOINT = "xmlrpc_boundary_entrypoint";

@:keep
final XMLRPC_BOUNDARY_SERVER = "xmlrpc_boundary_server";

@:keep
final XMLRPC_BOUNDARY_IXR_LIBRARY = "xmlrpc_boundary_ixr_library";

@:keep
final XMLRPC_BOUNDARY_AKISMET = "xmlrpc_boundary_akismet";

@:keep
final XMLRPC_BOUNDARY_HELLO = "xmlrpc_boundary_hello";

@:keep
final XMLRPC_BOUNDARY_PLUGIN_GUARD = "xmlrpc_boundary_plugin_guard";

@:keep
final XMLRPC_BOUNDARY_UNKNOWN = "xmlrpc_boundary_unknown";

@:keep
final XMLRPC_HANDOFF_AUTH_USERS = "xmlrpc_handoff_auth_users";

@:keep
final XMLRPC_HANDOFF_POSTS_QUERY = "xmlrpc_handoff_posts_query";

@:keep
final XMLRPC_HANDOFF_TAXONOMY_COMMENTS = "xmlrpc_handoff_taxonomy_comments";

@:keep
final XMLRPC_HANDOFF_MEDIA_UPLOAD = "xmlrpc_handoff_media_upload";

@:keep
final XMLRPC_HANDOFF_HTTP_PINGBACK = "xmlrpc_handoff_http_pingback";

@:keep
final XMLRPC_HANDOFF_MULTISITE = "xmlrpc_handoff_multisite";

@:keep
final XMLRPC_HANDOFF_DEPRECATED_API = "xmlrpc_handoff_deprecated_api";

@:keep
final XMLRPC_HANDOFF_UNKNOWN = "xmlrpc_handoff_unknown";

/**
	Chooses the endpoint admission intent before `xmlrpc.php` includes
	WordPress, sends headers, constructs `wp_xmlrpc_server`, or delegates to IXR.
**/
@:keep
function endpointPlan(xmlrpcEnabled:Bool, requestMethod:String, hasRequestBody:Bool):String
{
	return renderEndpointState(endpointState(xmlrpcEnabled, requestMethod, hasRequestBody));
}

/**
	Classifies the XML-RPC method namespace without claiming the concrete method
	registry or handler bodies in `wp_xmlrpc_server`.
**/
@:keep
function methodFamilyPlan(methodName:String):String
{
	return renderMethodFamily(methodFamily(methodName));
}

/**
	Models authentication and capability guard intent before WordPress user,
	capability, multisite, post, media, and option APIs execute.
**/
@:keep
function authGuardPlan(methodName:String, hasCredentials:Bool, authenticated:Bool, minimumArgsOk:Bool, canEditContent:Bool, canUploadFiles:Bool,
		canManageOptions:Bool):String
{
	if (isPublicMethod(methodName))
	{
		return XMLRPC_GUARD_PUBLIC_METHOD;
	}
	if (!minimumArgsOk)
	{
		return XMLRPC_GUARD_MINIMUM_ARGS_FAILED;
	}
	if (!hasCredentials)
	{
		return XMLRPC_GUARD_CREDENTIALS_MISSING;
	}
	if (!authenticated)
	{
		return XMLRPC_GUARD_AUTH_FAILED;
	}
	if (isMediaMethod(methodName) && !canUploadFiles)
	{
		return XMLRPC_GUARD_MEDIA_CAPABILITY_DENIED;
	}
	if (isOptionsMethod(methodName) && !canManageOptions)
	{
		return XMLRPC_GUARD_OPTIONS_CAPABILITY_DENIED;
	}
	if (isContentMethod(methodName) && !canEditContent)
	{
		return XMLRPC_GUARD_CONTENT_CAPABILITY_DENIED;
	}
	return XMLRPC_GUARD_READY;
}

/**
	Selects the IXR request/response envelope handoff shape without claiming XML
	parser behavior, serializer byte output, headers, or fault class ownership.
**/
@:keep
function ixrEnvelopePlan(hasXml:Bool, parseOk:Bool, hasMethodName:Bool, responseIsFault:Bool, responseReady:Bool):String
{
	return renderIxrEnvelope(ixrEnvelopeState(hasXml, parseOk, hasMethodName, responseIsFault, responseReady));
}

/**
	Classifies representative legacy/deprecated symbols while leaving the actual
	deprecation messages, hook calls, return values, and replacements to later
	parity fixtures.
**/
@:keep
function deprecatedSurfacePlan(symbolName:String):String
{
	final normalized = symbolName.trim();
	if (normalized == "wp-includes/deprecated.php")
	{
		return XMLRPC_DEPRECATED_FILE;
	}
	if (normalized == "get_alloptions" || normalized == "wp_get_links" || normalized == "get_currentuserinfo")
	{
		return XMLRPC_DEPRECATED_FUNCTION;
	}
	if (normalized == "wp_xmlrpc_server" || normalized == "IXR_Message" || normalized == "hello_dolly")
	{
		return XMLRPC_LEGACY_COMPAT_FUNCTION;
	}
	return XMLRPC_DEPRECATED_UNKNOWN;
}

/**
	Classifies source/artifact boundaries so Akismet, Hello Dolly, plugin guards,
	IXR, and first-party XML-RPC files cannot be collapsed into one ownership
	claim.
**/
@:keep
function boundaryPlan(path:String):String
{
	return renderLegacyBoundary(legacyBoundary(path));
}

/**
	Routes method families to the sibling WPHX domains that must provide concrete
	behavior before WPHX-318 can claim XML-RPC request parity.
**/
@:keep
function handoffPlan(methodName:String):String
{
	if (isAuthOrProfileMethod(methodName))
	{
		return XMLRPC_HANDOFF_AUTH_USERS;
	}
	if (isContentMethod(methodName))
	{
		return XMLRPC_HANDOFF_POSTS_QUERY;
	}
	if (isTaxonomyOrCommentMethod(methodName))
	{
		return XMLRPC_HANDOFF_TAXONOMY_COMMENTS;
	}
	if (isMediaMethod(methodName))
	{
		return XMLRPC_HANDOFF_MEDIA_UPLOAD;
	}
	if (methodName.indexOf("pingback.") == 0)
	{
		return XMLRPC_HANDOFF_HTTP_PINGBACK;
	}
	if (methodName.indexOf("wp.getUsersBlogs") == 0 || methodName.indexOf("wp.getSites") == 0)
	{
		return XMLRPC_HANDOFF_MULTISITE;
	}
	if (methodName.indexOf("deprecated.") == 0)
	{
		return XMLRPC_HANDOFF_DEPRECATED_API;
	}
	return XMLRPC_HANDOFF_UNKNOWN;
}

function endpointState(xmlrpcEnabled:Bool, requestMethod:String, hasRequestBody:Bool):XmlRpcEndpointState
{
	if (!xmlrpcEnabled)
	{
		return EndpointDisabled;
	}
	if (requestMethod.toUpperCase() != "POST")
	{
		return EndpointRejectNonPost;
	}
	if (!hasRequestBody)
	{
		return EndpointMissingBody;
	}
	return EndpointDispatch;
}

function methodFamily(methodName:String):XmlRpcMethodFamily
{
	if (methodName.indexOf("system.") == 0)
	{
		return SystemFamily;
	}
	if (methodName.indexOf("demo.") == 0)
	{
		return DemoFamily;
	}
	if (methodName.indexOf("wp.") == 0)
	{
		return WordPressFamily;
	}
	if (methodName.indexOf("blogger.") == 0)
	{
		return BloggerFamily;
	}
	if (methodName.indexOf("metaWeblog.") == 0)
	{
		return MetaWeblogFamily;
	}
	if (methodName.indexOf("mt.") == 0)
	{
		return MovableTypeFamily;
	}
	if (methodName.indexOf("pingback.") == 0)
	{
		return PingbackFamily;
	}
	return UnknownFamily;
}

function ixrEnvelopeState(hasXml:Bool, parseOk:Bool, hasMethodName:Bool, responseIsFault:Bool, responseReady:Bool):IxrEnvelopeState
{
	if (!hasXml)
	{
		return IxrMissingXml;
	}
	if (!parseOk)
	{
		return IxrParseFault;
	}
	if (!hasMethodName)
	{
		return IxrMissingMethod;
	}
	if (responseIsFault)
	{
		return IxrFaultResponse;
	}
	return responseReady ? IxrSuccessResponse : IxrMethodCall;
}

function legacyBoundary(path:String):LegacyBoundary
{
	final normalized = path.trim().toLowerCase();
	if (normalized == "xmlrpc.php")
	{
		return XmlRpcEntrypoint;
	}
	if (normalized == "wp-includes/class-wp-xmlrpc-server.php")
	{
		return XmlRpcServer;
	}
	if (normalized == "wp-includes/deprecated.php")
	{
		return CoreDeprecatedApi;
	}
	if (normalized == "wp-includes/class-ixr.php" || normalized.indexOf("wp-includes/ixr/") == 0)
	{
		return PreservedIxrLibrary;
	}
	if (normalized.indexOf("wp-content/plugins/akismet/") == 0)
	{
		return BundledAkismetDistribution;
	}
	if (normalized == "wp-content/plugins/hello.php")
	{
		return BundledHelloPlugin;
	}
	if (normalized == "wp-content/plugins/index.php")
	{
		return PluginDirectoryGuard;
	}
	return UnknownLegacyBoundary;
}

function isPublicMethod(methodName:String):Bool
{
	return methodName.indexOf("system.") == 0 || methodName.indexOf("demo.") == 0 || methodName.indexOf("pingback.") == 0;
}

function isMediaMethod(methodName:String):Bool
{
	return methodName == "wp.uploadFile"
		|| methodName == "metaWeblog.newMediaObject"
		|| methodName == "wp.getMediaItem"
		|| methodName == "wp.getMediaLibrary";
}

function isOptionsMethod(methodName:String):Bool
{
	return methodName == "wp.getOptions" || methodName == "wp.setOptions";
}

function isContentMethod(methodName:String):Bool
{
	return methodName.indexOf("wp.newPost") == 0
		|| methodName.indexOf("wp.editPost") == 0
		|| methodName.indexOf("wp.deletePost") == 0
		|| methodName.indexOf("metaWeblog.") == 0
		|| methodName.indexOf("blogger.") == 0
		|| methodName.indexOf("mt.") == 0;
}

function isTaxonomyOrCommentMethod(methodName:String):Bool
{
	return methodName.indexOf("wp.getTerm") == 0
		|| methodName.indexOf("wp.newTerm") == 0
		|| methodName.indexOf("wp.editTerm") == 0
		|| methodName.indexOf("wp.deleteTerm") == 0
		|| methodName.indexOf("wp.getComment") == 0
		|| methodName.indexOf("wp.editComment") == 0
		|| methodName.indexOf("wp.deleteComment") == 0;
}

function isAuthOrProfileMethod(methodName:String):Bool
{
	return methodName == "wp.getProfile"
		|| methodName == "wp.editProfile"
		|| methodName == "wp.getUser"
		|| methodName == "wp.getUsers";
}

function renderEndpointState(state:XmlRpcEndpointState):String
{
	return switch (state)
	{
		case EndpointDisabled: XMLRPC_ENDPOINT_DISABLED;
		case EndpointRejectNonPost: XMLRPC_ENDPOINT_REJECT_NON_POST;
		case EndpointMissingBody: XMLRPC_ENDPOINT_MISSING_BODY;
		case EndpointDispatch: XMLRPC_ENDPOINT_DISPATCH;
	}
}

function renderMethodFamily(family:XmlRpcMethodFamily):String
{
	return switch (family)
	{
		case SystemFamily: XMLRPC_METHOD_SYSTEM;
		case DemoFamily: XMLRPC_METHOD_DEMO;
		case WordPressFamily: XMLRPC_METHOD_WORDPRESS;
		case BloggerFamily: XMLRPC_METHOD_BLOGGER;
		case MetaWeblogFamily: XMLRPC_METHOD_META_WEBLOG;
		case MovableTypeFamily: XMLRPC_METHOD_MOVABLE_TYPE;
		case PingbackFamily: XMLRPC_METHOD_PINGBACK;
		case UnknownFamily: XMLRPC_METHOD_UNKNOWN;
	}
}

function renderIxrEnvelope(state:IxrEnvelopeState):String
{
	return switch (state)
	{
		case IxrMissingXml: XMLRPC_IXR_MISSING_XML;
		case IxrParseFault: XMLRPC_IXR_PARSE_FAULT;
		case IxrMissingMethod: XMLRPC_IXR_MISSING_METHOD;
		case IxrMethodCall: XMLRPC_IXR_METHOD_CALL;
		case IxrFaultResponse: XMLRPC_IXR_FAULT_RESPONSE;
		case IxrSuccessResponse: XMLRPC_IXR_SUCCESS_RESPONSE;
	}
}

function renderLegacyBoundary(boundary:LegacyBoundary):String
{
	return switch (boundary)
	{
		case CoreDeprecatedApi: XMLRPC_BOUNDARY_DEPRECATED_API;
		case XmlRpcEntrypoint: XMLRPC_BOUNDARY_ENTRYPOINT;
		case XmlRpcServer: XMLRPC_BOUNDARY_SERVER;
		case PreservedIxrLibrary: XMLRPC_BOUNDARY_IXR_LIBRARY;
		case BundledAkismetDistribution: XMLRPC_BOUNDARY_AKISMET;
		case BundledHelloPlugin: XMLRPC_BOUNDARY_HELLO;
		case PluginDirectoryGuard: XMLRPC_BOUNDARY_PLUGIN_GUARD;
		case UnknownLegacyBoundary: XMLRPC_BOUNDARY_UNKNOWN;
	}
}
