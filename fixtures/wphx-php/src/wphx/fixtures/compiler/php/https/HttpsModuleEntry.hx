package wphx.fixtures.compiler.php.https;

import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpIsHomeUrlUsingHttps;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpGetHttpsDetectionErrors;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpIsHttpsSupported;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpIsLocalHtmlOutput;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpIsSiteUrlUsingHttps;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpIsUsingHttps;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpReplaceInsecureHomeUrl;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpShouldReplaceInsecureHomeUrl;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpUpdateHttpsMigrationRequired;
import wphx.fixtures.compiler.php.https.HttpsModuleSurface.wpUpdateUrlsToHttps;

/**
	Compile anchor for original-path HTTPS module function adapters.
**/
class HttpsModuleEntry
{
	static function main():Void
	{
		wpIsUsingHttps();
		wpIsHomeUrlUsingHttps();
		wpIsSiteUrlUsingHttps();
		wpIsHttpsSupported();
		wpGetHttpsDetectionErrors();
		wpIsLocalHtmlOutput("");
		wpShouldReplaceInsecureHomeUrl();
		wpReplaceInsecureHomeUrl("");
		wpUpdateUrlsToHttps();
		wpUpdateHttpsMigrationRequired("", "");
	}
}
