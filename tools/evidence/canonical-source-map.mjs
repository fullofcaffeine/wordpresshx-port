import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const DIGEST_POLICY = "canonical-source-map-v1";
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\//;
const MACHINE_LOCAL_ROOTS = [
  /^\/Users\/[^/]+(?:\/|$)/,
  /^\/home\/[^/]+(?:\/|$)/,
  /^\/(?:private\/)?var\/folders\/[^/]+\/[^/]+(?:\/|$)/,
  /^[A-Za-z]:\/Users\/[^/]+(?:\/|$)/i,
  /^[A-Za-z]:\/Documents and Settings\/[^/]+(?:\/|$)/i
];

function slash(value) {
  return value.replaceAll("\\", "/");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return typeof value === "string" ? normalizeLineEndings(value) : value;
}

function isAbsolutePath(value) {
  return isAbsolute(value) || WINDOWS_ABSOLUTE_PATH.test(slash(value));
}

function normalizeAbsolutePath(value) {
  const slashed = slash(value);
  if (slashed === "/") return slashed;
  if (/^[A-Za-z]:\/+$/i.test(slashed)) return `${slashed[0].toUpperCase()}:/`;
  const normalized = slashed.replace(/\/+$/, "");
  return WINDOWS_ABSOLUTE_PATH.test(normalized)
    ? `${normalized[0].toUpperCase()}${normalized.slice(1)}`
    : normalized;
}

function pathComparisonKey(value) {
  const normalized = normalizeAbsolutePath(value);
  return WINDOWS_ABSOLUTE_PATH.test(normalized) ? normalized.toLowerCase() : normalized;
}

function pathWithin(root, candidate) {
  const rootKey = pathComparisonKey(root);
  const candidateKey = pathComparisonKey(candidate);
  if (rootKey === "/") return candidateKey.startsWith("/");
  return candidateKey === rootKey || candidateKey.startsWith(`${rootKey}/`);
}

function portableRelative(root, candidate) {
  const normalizedRoot = normalizeAbsolutePath(root);
  const normalizedCandidate = normalizeAbsolutePath(candidate);
  if (pathWithin(normalizedRoot, normalizedCandidate)) {
    return normalizedCandidate.slice(normalizedRoot.length).replace(/^\//, "");
  }
  return slash(relative(normalizedRoot, normalizedCandidate));
}

function resolvedSourcePath(mapPath, sourceRoot, source) {
  const normalizedSource = slash(source);
  if (isAbsolutePath(normalizedSource)) return normalizeAbsolutePath(normalizedSource);

  const normalizedSourceRoot = slash(sourceRoot);
  if (isAbsolutePath(normalizedSourceRoot)) {
    return normalizeAbsolutePath(`${normalizedSourceRoot}/${normalizedSource}`);
  }
  return slash(resolve(dirname(mapPath), normalizedSourceRoot, normalizedSource));
}

function externalPathSuffix(absolute) {
  const normalized = normalizeAbsolutePath(absolute);
  const withoutMachineRoot = normalized
    .replace(/^\/Users\/[^/]+\/?/, "")
    .replace(/^\/home\/[^/]+\/?/, "")
    .replace(/^\/(?:private\/)?var\/folders\/[^/]+\/[^/]+\/?/, "")
    .replace(/^[A-Za-z]:\/Users\/[^/]+\/?/i, "")
    .replace(/^[A-Za-z]:\/Documents and Settings\/[^/]+\/?/i, "");
  const parts = withoutMachineRoot.split("/").filter(Boolean);
  return parts.slice(-4).join("/") || "unknown";
}

export function canonicalSourcePath(mapPath, sourceRoot, source, { repositoryRoot = process.cwd() } = {}) {
  const absolute = resolvedSourcePath(mapPath, sourceRoot, source);
  const absoluteRepositoryRoot = isAbsolutePath(repositoryRoot) ? repositoryRoot : resolve(repositoryRoot);
  if (pathWithin(absoluteRepositoryRoot, absolute)) {
    return `<repo>/${portableRelative(absoluteRepositoryRoot, absolute)}`;
  }

  const normalized = normalizeAbsolutePath(absolute);
  const stdMarker = "/std/";
  const stdIndex = normalized.lastIndexOf(stdMarker);
  if (stdIndex !== -1) {
    return `<haxe-std>/${normalized.slice(stdIndex + stdMarker.length)}`;
  }

  for (const marker of ["/haxe_libraries/", "/.haxelib/"]) {
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex !== -1) {
      return `<haxelib>/${normalized.slice(markerIndex + marker.length)}`;
    }
  }

  return `<external>/${externalPathSuffix(normalized)}`;
}

function canonicalMapFile(mapPath, file, options) {
  if (typeof file !== "string") return file;
  const normalized = slash(file);
  return isAbsolutePath(normalized) ? canonicalSourcePath(mapPath, "", normalized, options) : normalized;
}

function recordedArtifactPath(mapPath, repositoryRoot) {
  const absoluteMapPath = isAbsolutePath(mapPath) ? mapPath : resolve(mapPath);
  const absoluteRepositoryRoot = isAbsolutePath(repositoryRoot) ? repositoryRoot : resolve(repositoryRoot);
  if (pathWithin(absoluteRepositoryRoot, absoluteMapPath)) {
    return portableRelative(absoluteRepositoryRoot, absoluteMapPath);
  }
  return `<external>/${externalPathSuffix(absoluteMapPath)}`;
}

export function canonicalSourceMap(mapPath, { repositoryRoot = process.cwd() } = {}) {
  const rawText = readFileSync(mapPath, "utf8");
  const parsed = JSON.parse(normalizeLineEndings(rawText));
  if (!isRecord(parsed)) throw new Error(`${mapPath} must contain a source-map object`);
  if (!Array.isArray(parsed.sources) || !parsed.sources.every((source) => typeof source === "string")) {
    throw new Error(`${mapPath} must contain a string sources array`);
  }
  if (parsed.sourceRoot !== undefined && typeof parsed.sourceRoot !== "string") {
    throw new Error(`${mapPath} sourceRoot must be a string when present`);
  }

  const sourceRoot = parsed.sourceRoot ?? "";
  const options = { repositoryRoot };
  const canonical = {
    ...parsed,
    file: canonicalMapFile(mapPath, parsed.file, options),
    sourceRoot: "",
    sources: parsed.sources.map((source) => canonicalSourcePath(mapPath, sourceRoot, source, options))
  };
  if (parsed.file === undefined) delete canonical.file;

  const stableMap = stableJson(canonical);
  return { map: stableMap, text: `${JSON.stringify(stableMap)}\n` };
}

export function canonicalSourceMapRecord(mapPath, { repositoryRoot = process.cwd(), path = null } = {}) {
  const canonical = canonicalSourceMap(mapPath, { repositoryRoot });
  const rawArtifact = statSync(mapPath);
  return {
    path: path ?? recordedArtifactPath(mapPath, repositoryRoot),
    raw_artifact_present: rawArtifact.isFile(),
    canonical_bytes: Buffer.byteLength(canonical.text),
    digest_policy: DIGEST_POLICY,
    canonical_sha256: `sha256:${createHash("sha256").update(canonical.text).digest("hex")}`,
    source_count: canonical.map.sources.length,
    sources: canonical.map.sources
  };
}

export function findMachineLocalPaths(value, location = "$") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findMachineLocalPaths(entry, `${location}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) => findMachineLocalPaths(entry, `${location}.${key}`));
  }
  if (typeof value !== "string") return [];
  const normalized = slash(value);
  return MACHINE_LOCAL_ROOTS.some((pattern) => pattern.test(normalized)) ? [{ location, value }] : [];
}
