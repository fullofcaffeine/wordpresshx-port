package wphx.fixtures.compiler.php.https;

import wphx.wp.boundary.NativeValue.NativeValue;

/**
	Selected WordPress HTTPS module functions emitted at their original paths.
**/
@:wp.file("wp-includes/https-detection.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_is_using_https")
@:keep
function wpIsUsingHttps():Bool
{
	return HaxeHttpsKernel.isUsingHttps();
}

@:wp.file("wp-includes/https-detection.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_is_home_url_using_https")
@:keep
function wpIsHomeUrlUsingHttps():Bool
{
	return HaxeHttpsKernel.isHomeUrlUsingHttps();
}

@:wp.file("wp-includes/https-detection.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_is_site_url_using_https")
@:keep
function wpIsSiteUrlUsingHttps():Bool
{
	return HaxeHttpsKernel.isSiteUrlUsingHttps();
}

@:wp.file("wp-includes/https-detection.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_is_local_html_output")
@:keep
function wpIsLocalHtmlOutput(@:wp.name("html") html:String):NativeValue
{
	return HaxeHttpsKernel.isLocalHtmlOutput(html);
}

@:wp.file("wp-includes/https-migration.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_should_replace_insecure_home_url")
@:keep
function wpShouldReplaceInsecureHomeUrl():Bool
{
	return HaxeHttpsKernel.shouldReplaceInsecureHomeUrl();
}

@:wp.file("wp-includes/https-migration.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_replace_insecure_home_url")
@:keep
function wpReplaceInsecureHomeUrl(@:wp.name("content") content:String):String
{
	return HaxeHttpsKernel.replaceInsecureHomeUrl(content);
}

@:wp.file("wp-includes/https-migration.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_update_urls_to_https")
@:keep
function wpUpdateUrlsToHttps():Bool
{
	return HaxeHttpsKernel.updateUrlsToHttps();
}

@:wp.file("wp-includes/https-migration.php")
@:wp.haxeBootstrap("WPHX_HTTPS_MODULE_BOOTSTRAPPED")
@:wp.global("wp_update_https_migration_required")
@:keep
function wpUpdateHttpsMigrationRequired(@:wp.name("old_url") oldUrl:NativeValue, @:wp.name("new_url") newUrl:NativeValue):Void
{
	HaxeHttpsKernel.updateHttpsMigrationRequired(oldUrl, newUrl);
}
