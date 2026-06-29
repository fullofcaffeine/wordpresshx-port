package wphx.fixtures.wp.core;

import wphx.wp.media.MediaUploadAdapterContract.attachmentMetadataPlan;
import wphx.wp.media.MediaUploadAdapterContract.filesystemPlan;
import wphx.wp.media.MediaUploadAdapterContract.hookPlan;
import wphx.wp.media.MediaUploadAdapterContract.mimeFiletypePlan;
import wphx.wp.media.MediaUploadAdapterContract.uniqueFilenamePlan;
import wphx.wp.media.MediaUploadAdapterContract.uploadValidationPlan;

/**
	Deterministic executable probe for the WPHX-313 media/upload adapter
	contract. Each output line is consumed by the runner and compared with a
	stable expectation before any receipt is written.
**/
@:keep
class MediaUploadAdapterContractCandidateEntry
{
	static function main():Void
	{
		emit("upload:no-file", uploadValidationPlan(false, true, true, true, true, false));
		emit("upload:php-error", uploadValidationPlan(true, false, true, true, true, false));
		emit("upload:form", uploadValidationPlan(true, true, false, true, true, false));
		emit("upload:size", uploadValidationPlan(true, true, true, false, true, false));
		emit("upload:mime-reject", uploadValidationPlan(true, true, true, true, false, false));
		emit("upload:override", uploadValidationPlan(true, true, true, true, false, true));
		emit("upload:accepted", uploadValidationPlan(true, true, true, true, true, false));

		emit("mime:unknown", mimeFiletypePlan("", true, true, true));
		emit("mime:rejected", mimeFiletypePlan("exe", false, true, false));
		emit("mime:mismatch", mimeFiletypePlan("jpg", true, false, true));
		emit("mime:allowed", mimeFiletypePlan("png", true, true, true));

		emit("unique:preserve", uniqueFilenamePlan(false, false, false, false));
		emit("unique:sanitized", uniqueFilenamePlan(true, false, false, false));
		emit("unique:suffix", uniqueFilenamePlan(false, true, true, false));
		emit("unique:increment", uniqueFilenamePlan(false, true, false, false));
		emit("unique:lowercase", uniqueFilenamePlan(false, false, false, true));

		emit("meta:no-editor", attachmentMetadataPlan(false, true, true, false));
		emit("meta:basic", attachmentMetadataPlan(true, false, true, false));
		emit("meta:preserve", attachmentMetadataPlan(true, true, true, true));
		emit("meta:subsizes", attachmentMetadataPlan(true, true, true, false));
		emit("meta:identify", attachmentMetadataPlan(true, true, false, false));

		emit("fs:credentials", filesystemPlan(true, false, true, true, true));
		emit("fs:direct", filesystemPlan(false, false, true, false, false));
		emit("fs:ssh2", filesystemPlan(false, false, false, true, true));
		emit("fs:ftp", filesystemPlan(false, false, false, false, true));
		emit("fs:unavailable", filesystemPlan(false, false, false, false, false));

		emit("hook:prefilter", hookPlan("wp_handle_upload_prefilter", true));
		emit("hook:mime", hookPlan("upload_mimes", true));
		emit("hook:attachment", hookPlan("wp_generate_attachment_metadata", true));
		emit("hook:filesystem", hookPlan("request_filesystem_credentials", true));
		emit("hook:failed", hookPlan("upload_mimes", false));
	}

	static function emit(key:String, value:String):Void
	{
		Sys.println(key + "=" + value);
	}
}
