package wphx.wp.http;

using StringTools;

@:keep
class HttpCronMailFeedEmbedAdapterContract
{
	public static inline final HTTP_PREEMPT = "http_preempt";
	public static inline final HTTP_BLOCKED = "http_blocked";
	public static inline final HTTP_CURL = "http_curl";
	public static inline final HTTP_STREAMS = "http_streams";
	public static inline final HTTP_ERROR = "http_error";

	public static inline final CRON_RESCHEDULE_RECURRING = "cron_reschedule_recurring";
	public static inline final CRON_RUN_DUE = "cron_run_due";
	public static inline final CRON_SPAWN_LOCKED = "cron_spawn_locked";
	public static inline final CRON_SPAWN_REQUEST = "cron_spawn_request";
	public static inline final CRON_NOOP = "cron_noop";

	public static inline final MAIL_SHORT_CIRCUIT = "mail_short_circuit";
	public static inline final MAIL_INVALID_RECIPIENTS = "mail_invalid_recipients";
	public static inline final MAIL_WITH_ATTACHMENTS = "mail_with_attachments";
	public static inline final MAIL_RECOVERY = "mail_recovery";
	public static inline final MAIL_STANDARD = "mail_standard";

	public static inline final FEED_ATOM = "feed_atom";
	public static inline final FEED_RSS2 = "feed_rss2";
	public static inline final FEED_COMMENTS = "feed_comments";
	public static inline final FEED_OPML = "feed_opml";
	public static inline final FEED_FETCH_REMOTE = "feed_fetch_remote";
	public static inline final FEED_UNKNOWN = "feed_unknown";

	public static inline final EMBED_REST_RESPONSE = "embed_rest_response";
	public static inline final EMBED_DISCOVERY = "embed_discovery";
	public static inline final EMBED_SHORTCODE = "embed_shortcode";
	public static inline final EMBED_TEMPLATE = "embed_template";
	public static inline final EMBED_DISABLED = "embed_disabled";

	public static inline final HTTPS_ALREADY = "https_already";
	public static inline final HTTPS_DETECT = "https_detect";
	public static inline final HTTPS_MIGRATE = "https_migrate";
	public static inline final HTTPS_NOOP = "https_noop";

	public static inline final PRIVACY_EXPORT_MAIL = "privacy_export_mail";
	public static inline final PRIVACY_ERASURE_MAIL = "privacy_erasure_mail";
	public static inline final PRIVACY_LIST_TABLE = "privacy_list_table";

	public static inline final AI_HTTP_AUTHENTICATED = "ai_http_authenticated";
	public static inline final AI_HTTP_DISCOVERY = "ai_http_discovery";
	public static inline final AI_HTTP_TRANSPORT = "ai_http_transport";

	public static inline final TRACKBACK_REJECT = "trackback_reject";
	public static inline final TRACKBACK_ACCEPT = "trackback_accept";
	public static inline final TRACKBACK_PING = "trackback_ping";

	public static inline final HOOK_NONE = "http_cron_mail_feed_embed_no_hooks";
	public static inline final HOOK_HTTP = "http_hooks";
	public static inline final HOOK_CRON = "cron_hooks";
	public static inline final HOOK_MAIL = "mail_hooks";
	public static inline final HOOK_FEED = "feed_hooks";
	public static inline final HOOK_EMBED = "embed_hooks";

	public static function httpTransportPlan(preempted:Bool, blockedByPolicy:Bool, curlAvailable:Bool, streamsAvailable:Bool):String
	{
		if (preempted)
		{
			return HTTP_PREEMPT;
		}
		if (blockedByPolicy)
		{
			return HTTP_BLOCKED;
		}
		if (curlAvailable)
		{
			return HTTP_CURL;
		}
		if (streamsAvailable)
		{
			return HTTP_STREAMS;
		}
		return HTTP_ERROR;
	}

	public static function cronPlan(eventDue:Bool, recurring:Bool, doingCronLocked:Bool, spawnRequested:Bool):String
	{
		if (eventDue && recurring)
		{
			return CRON_RESCHEDULE_RECURRING;
		}
		if (eventDue)
		{
			return CRON_RUN_DUE;
		}
		if (doingCronLocked)
		{
			return CRON_SPAWN_LOCKED;
		}
		return spawnRequested ? CRON_SPAWN_REQUEST : CRON_NOOP;
	}

	public static function mailPlan(shortCircuited:Bool, recipientsPresent:Bool, hasAttachments:Bool, recoveryMode:Bool):String
	{
		if (shortCircuited)
		{
			return MAIL_SHORT_CIRCUIT;
		}
		if (!recipientsPresent)
		{
			return MAIL_INVALID_RECIPIENTS;
		}
		if (recoveryMode)
		{
			return MAIL_RECOVERY;
		}
		return hasAttachments ? MAIL_WITH_ATTACHMENTS : MAIL_STANDARD;
	}

	public static function feedPlan(feedType:String, comments:Bool, opml:Bool, fetchRemote:Bool):String
	{
		if (opml)
		{
			return FEED_OPML;
		}
		if (fetchRemote)
		{
			return FEED_FETCH_REMOTE;
		}
		if (comments)
		{
			return FEED_COMMENTS;
		}
		return switch feedType.trim().toLowerCase()
		{
			case "atom":
				FEED_ATOM;
			case "rss2" | "rss":
				FEED_RSS2;
			case _:
				FEED_UNKNOWN;
		}
	}

	public static function embedPlan(restRequest:Bool, discoveryAllowed:Bool, shortcodePresent:Bool, templateRequest:Bool):String
	{
		if (restRequest)
		{
			return EMBED_REST_RESPONSE;
		}
		if (templateRequest)
		{
			return EMBED_TEMPLATE;
		}
		if (shortcodePresent)
		{
			return EMBED_SHORTCODE;
		}
		return discoveryAllowed ? EMBED_DISCOVERY : EMBED_DISABLED;
	}

	public static function httpsPlan(siteAlreadyHttps:Bool, detectionNeeded:Bool, migrationEligible:Bool):String
	{
		if (siteAlreadyHttps)
		{
			return HTTPS_ALREADY;
		}
		if (migrationEligible)
		{
			return HTTPS_MIGRATE;
		}
		return detectionNeeded ? HTTPS_DETECT : HTTPS_NOOP;
	}

	public static function privacyRequestPlan(requestKind:String, sendEmail:Bool):String
	{
		return switch requestKind.trim().toLowerCase()
		{
			case "export":
				sendEmail ? PRIVACY_EXPORT_MAIL : PRIVACY_LIST_TABLE;
			case "erase" | "erasure":
				sendEmail ? PRIVACY_ERASURE_MAIL : PRIVACY_LIST_TABLE;
			case _:
				PRIVACY_LIST_TABLE;
		}
	}

	public static function aiHttpPlan(hasAuthentication:Bool, needsDiscovery:Bool):String
	{
		if (hasAuthentication)
		{
			return AI_HTTP_AUTHENTICATED;
		}
		return needsDiscovery ? AI_HTTP_DISCOVERY : AI_HTTP_TRANSPORT;
	}

	public static function trackbackPlan(validUrl:Bool, commentOpen:Bool, pingOnly:Bool):String
	{
		if (!validUrl || !commentOpen)
		{
			return TRACKBACK_REJECT;
		}
		return pingOnly ? TRACKBACK_PING : TRACKBACK_ACCEPT;
	}

	public static function hookPlan(operation:String, succeeded:Bool):String
	{
		if (!succeeded)
		{
			return HOOK_NONE;
		}
		return switch operation.trim().toLowerCase()
		{
			case "http" | "pre_http_request" | "http_api_debug":
				HOOK_HTTP;
			case "cron" | "schedule_event" | "spawn_cron":
				HOOK_CRON;
			case "mail" | "phpmailer" | "wp_mail":
				HOOK_MAIL;
			case "feed" | "rss2" | "atom":
				HOOK_FEED;
			case "embed" | "oembed":
				HOOK_EMBED;
			case _:
				HOOK_NONE;
		}
	}
}
