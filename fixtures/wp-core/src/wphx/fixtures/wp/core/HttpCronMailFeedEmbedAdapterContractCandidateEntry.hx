package wphx.fixtures.wp.core;

import wphx.wp.http.HttpCronMailFeedEmbedAdapterContract;

@:keep
class HttpCronMailFeedEmbedAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("http:preempt", HttpCronMailFeedEmbedAdapterContract.httpTransportPlan(true, false, true, true));
		emit("http:blocked", HttpCronMailFeedEmbedAdapterContract.httpTransportPlan(false, true, true, true));
		emit("http:curl", HttpCronMailFeedEmbedAdapterContract.httpTransportPlan(false, false, true, true));
		emit("http:streams", HttpCronMailFeedEmbedAdapterContract.httpTransportPlan(false, false, false, true));
		emit("http:error", HttpCronMailFeedEmbedAdapterContract.httpTransportPlan(false, false, false, false));

		emit("cron:recurring", HttpCronMailFeedEmbedAdapterContract.cronPlan(true, true, false, false));
		emit("cron:due", HttpCronMailFeedEmbedAdapterContract.cronPlan(true, false, false, false));
		emit("cron:locked", HttpCronMailFeedEmbedAdapterContract.cronPlan(false, false, true, true));
		emit("cron:spawn", HttpCronMailFeedEmbedAdapterContract.cronPlan(false, false, false, true));
		emit("cron:noop", HttpCronMailFeedEmbedAdapterContract.cronPlan(false, false, false, false));

		emit("mail:short-circuit", HttpCronMailFeedEmbedAdapterContract.mailPlan(true, true, false, false));
		emit("mail:invalid", HttpCronMailFeedEmbedAdapterContract.mailPlan(false, false, false, false));
		emit("mail:attachments", HttpCronMailFeedEmbedAdapterContract.mailPlan(false, true, true, false));
		emit("mail:recovery", HttpCronMailFeedEmbedAdapterContract.mailPlan(false, true, false, true));
		emit("mail:standard", HttpCronMailFeedEmbedAdapterContract.mailPlan(false, true, false, false));

		emit("feed:atom", HttpCronMailFeedEmbedAdapterContract.feedPlan("atom", false, false, false));
		emit("feed:rss2", HttpCronMailFeedEmbedAdapterContract.feedPlan("rss2", false, false, false));
		emit("feed:comments", HttpCronMailFeedEmbedAdapterContract.feedPlan("rss2", true, false, false));
		emit("feed:opml", HttpCronMailFeedEmbedAdapterContract.feedPlan("rss2", false, true, false));
		emit("feed:remote", HttpCronMailFeedEmbedAdapterContract.feedPlan("rss2", false, false, true));
		emit("feed:unknown", HttpCronMailFeedEmbedAdapterContract.feedPlan("rdf", false, false, false));

		emit("embed:rest", HttpCronMailFeedEmbedAdapterContract.embedPlan(true, true, true, true));
		emit("embed:template", HttpCronMailFeedEmbedAdapterContract.embedPlan(false, true, true, true));
		emit("embed:shortcode", HttpCronMailFeedEmbedAdapterContract.embedPlan(false, true, true, false));
		emit("embed:discovery", HttpCronMailFeedEmbedAdapterContract.embedPlan(false, true, false, false));
		emit("embed:disabled", HttpCronMailFeedEmbedAdapterContract.embedPlan(false, false, false, false));

		emit("https:already", HttpCronMailFeedEmbedAdapterContract.httpsPlan(true, true, true));
		emit("https:migrate", HttpCronMailFeedEmbedAdapterContract.httpsPlan(false, true, true));
		emit("https:detect", HttpCronMailFeedEmbedAdapterContract.httpsPlan(false, true, false));
		emit("https:noop", HttpCronMailFeedEmbedAdapterContract.httpsPlan(false, false, false));

		emit("privacy:export-mail", HttpCronMailFeedEmbedAdapterContract.privacyRequestPlan("export", true));
		emit("privacy:erasure-mail", HttpCronMailFeedEmbedAdapterContract.privacyRequestPlan("erase", true));
		emit("privacy:list-table", HttpCronMailFeedEmbedAdapterContract.privacyRequestPlan("unknown", false));

		emit("ai-http:authenticated", HttpCronMailFeedEmbedAdapterContract.aiHttpPlan(true, true));
		emit("ai-http:discovery", HttpCronMailFeedEmbedAdapterContract.aiHttpPlan(false, true));
		emit("ai-http:transport", HttpCronMailFeedEmbedAdapterContract.aiHttpPlan(false, false));

		emit("trackback:reject", HttpCronMailFeedEmbedAdapterContract.trackbackPlan(false, true, false));
		emit("trackback:accept", HttpCronMailFeedEmbedAdapterContract.trackbackPlan(true, true, false));
		emit("trackback:ping", HttpCronMailFeedEmbedAdapterContract.trackbackPlan(true, true, true));

		emit("hook:http", HttpCronMailFeedEmbedAdapterContract.hookPlan("pre_http_request", true));
		emit("hook:cron", HttpCronMailFeedEmbedAdapterContract.hookPlan("spawn_cron", true));
		emit("hook:mail", HttpCronMailFeedEmbedAdapterContract.hookPlan("wp_mail", true));
		emit("hook:feed", HttpCronMailFeedEmbedAdapterContract.hookPlan("rss2", true));
		emit("hook:embed", HttpCronMailFeedEmbedAdapterContract.hookPlan("oembed", true));
		emit("hook:failed", HttpCronMailFeedEmbedAdapterContract.hookPlan("oembed", false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
