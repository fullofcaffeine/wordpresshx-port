package wphx.wp.media;

using StringTools;

/**
	Typed WPHX-313 media/upload adapter contract decisions.

	This module models narrow branch choices that WordPress exposes through upload
	validation, MIME checks, unique filename generation, attachment metadata,
	filesystem access, and hook timing. It is not a public PHP implementation and
	does not own native file IO, image libraries, REST/admin request handling, or
	installed-distribution behavior.
**/
@:keep
final UPLOAD_ACCEPTED = "upload_accepted";

@:keep
final UPLOAD_NO_FILE = "upload_no_file";

@:keep
final UPLOAD_PHP_ERROR = "upload_php_error";

@:keep
final UPLOAD_FORM_REJECTED = "upload_form_rejected";

@:keep
final UPLOAD_TOO_LARGE = "upload_too_large";

@:keep
final UPLOAD_MIME_REJECTED = "upload_mime_rejected";

@:keep
final UPLOAD_OVERRIDE_ACCEPTED = "upload_override_accepted";

@:keep
final MIME_ALLOWED = "mime_allowed";

@:keep
final MIME_UNKNOWN_EXTENSION = "mime_unknown_extension";

@:keep
final MIME_REAL_MISMATCH = "mime_real_mismatch";

@:keep
final MIME_REJECTED = "mime_rejected";

@:keep
final UNIQUE_PRESERVE = "unique_preserve";

@:keep
final UNIQUE_SANITIZED = "unique_sanitized";

@:keep
final UNIQUE_INCREMENT = "unique_increment";

@:keep
final UNIQUE_SUFFIX = "unique_suffix";

@:keep
final UNIQUE_LOWERCASE_EXTENSION = "unique_lowercase_extension";

@:keep
final META_IDENTIFY_IMAGE = "metadata_identify_image";

@:keep
final META_GENERATE_SUBSIZES = "metadata_generate_subsizes";

@:keep
final META_PRESERVE_EXISTING = "metadata_preserve_existing";

@:keep
final META_EDITOR_UNAVAILABLE = "metadata_editor_unavailable";

@:keep
final META_BASIC_ATTACHMENT = "metadata_basic_attachment";

@:keep
final FS_DIRECT = "filesystem_direct";

@:keep
final FS_CREDENTIALS_REQUIRED = "filesystem_credentials_required";

@:keep
final FS_SSH2 = "filesystem_ssh2";

@:keep
final FS_FTP = "filesystem_ftp";

@:keep
final FS_UNAVAILABLE = "filesystem_unavailable";

@:keep
final HOOK_NONE = "media_upload_no_hooks";

@:keep
final HOOK_PREFILTER = "media_upload_prefilter_hooks";

@:keep
final HOOK_MIME = "media_upload_mime_hooks";

@:keep
final HOOK_ATTACHMENT = "media_attachment_hooks";

@:keep
final HOOK_FILESYSTEM = "media_filesystem_hooks";

/**
	Chooses the upload validation branch before public PHP performs native file
	movement or request-state mutation.
**/
@:keep
function uploadValidationPlan(fileProvided:Bool, phpUploadOk:Bool, formTestPassed:Bool, sizeAllowed:Bool, mimeAllowed:Bool, overrideAllowed:Bool):String
{
	if (!fileProvided)
	{
		return UPLOAD_NO_FILE;
	}
	if (!phpUploadOk)
	{
		return UPLOAD_PHP_ERROR;
	}
	if (!formTestPassed)
	{
		return UPLOAD_FORM_REJECTED;
	}
	if (!sizeAllowed)
	{
		return UPLOAD_TOO_LARGE;
	}
	if (!mimeAllowed)
	{
		return overrideAllowed ? UPLOAD_OVERRIDE_ACCEPTED : UPLOAD_MIME_REJECTED;
	}
	return UPLOAD_ACCEPTED;
}

/**
	Models the MIME/filetype trust branch without reading file contents.
**/
@:keep
function mimeFiletypePlan(extension:String, declaredMimeAllowed:Bool, realMimeMatches:Bool, strictImageCheck:Bool):String
{
	if (extension.trim() == "")
	{
		return MIME_UNKNOWN_EXTENSION;
	}
	if (!declaredMimeAllowed)
	{
		return MIME_REJECTED;
	}
	if (strictImageCheck && !realMimeMatches)
	{
		return MIME_REAL_MISMATCH;
	}
	return MIME_ALLOWED;
}

/**
	Models filename routing before PHP owns path normalization and filesystem
	existence checks.
**/
@:keep
function uniqueFilenamePlan(sanitizedChanged:Bool, originalExists:Bool, customSuffixRequested:Bool, extensionNeedsLowercase:Bool):String
{
	if (sanitizedChanged)
	{
		return UNIQUE_SANITIZED;
	}
	if (originalExists && customSuffixRequested)
	{
		return UNIQUE_SUFFIX;
	}
	if (originalExists)
	{
		return UNIQUE_INCREMENT;
	}
	if (extensionNeedsLowercase)
	{
		return UNIQUE_LOWERCASE_EXTENSION;
	}
	return UNIQUE_PRESERVE;
}

/**
	Chooses the attachment metadata/image-editor handoff. Native image probing,
	editor implementations, and generated sizes remain PHP/provider behavior.
**/
@:keep
function attachmentMetadataPlan(hasImageEditor:Bool, canReadImageSize:Bool, generateSubsizes:Bool, existingMetadataPresent:Bool):String
{
	if (!hasImageEditor)
	{
		return META_EDITOR_UNAVAILABLE;
	}
	if (!canReadImageSize)
	{
		return META_BASIC_ATTACHMENT;
	}
	if (existingMetadataPresent)
	{
		return META_PRESERVE_EXISTING;
	}
	return generateSubsizes ? META_GENERATE_SUBSIZES : META_IDENTIFY_IMAGE;
}

/**
	Routes filesystem access intent while concrete credentials, transports, and
	stream operations remain native PHP/public-adapter responsibilities.
**/
@:keep
function filesystemPlan(credentialsRequired:Bool, credentialsProvided:Bool, directAvailable:Bool, ssh2Available:Bool, ftpAvailable:Bool):String
{
	if (credentialsRequired && !credentialsProvided)
	{
		return FS_CREDENTIALS_REQUIRED;
	}
	if (directAvailable)
	{
		return FS_DIRECT;
	}
	if (ssh2Available)
	{
		return FS_SSH2;
	}
	if (ftpAvailable)
	{
		return FS_FTP;
	}
	return FS_UNAVAILABLE;
}

/**
	Names hook families expected around media/upload operations.
**/
@:keep
function hookPlan(operation:String, succeeded:Bool):String
{
	if (!succeeded)
	{
		return HOOK_NONE;
	}
	return switch operation.trim().toLowerCase()
	{
		case "prefilter" | "wp_handle_upload_prefilter":
			HOOK_PREFILTER;
		case "mime" | "upload_mimes" | "wp_check_filetype_and_ext":
			HOOK_MIME;
		case "attachment" | "metadata" | "wp_generate_attachment_metadata":
			HOOK_ATTACHMENT;
		case "filesystem" | "credentials" | "request_filesystem_credentials":
			HOOK_FILESYSTEM;
		case _:
			HOOK_NONE;
	}
}
