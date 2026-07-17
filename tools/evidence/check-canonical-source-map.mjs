#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalSourceMap,
  canonicalSourceMapRecord,
  canonicalSourcePath,
  findMachineLocalPaths
} from "./canonical-source-map.mjs";

function writeMap(repositoryRoot, mappings = "AAAA", sourcesContent = ["class Probe {}\n"]) {
  const mapPath = join(repositoryRoot, "build/debug/lib/Probe.php.map");
  const sourcePath = join(repositoryRoot, "fixtures/src/Probe.hx");
  mkdirSync(join(repositoryRoot, "build/debug/lib"), { recursive: true });
  mkdirSync(join(repositoryRoot, "fixtures/src"), { recursive: true });
  writeFileSync(sourcePath, sourcesContent[0]);
  writeFileSync(
    mapPath,
    `${JSON.stringify({
      version: 3,
      file: join(repositoryRoot, "build/debug/lib/Probe.php"),
      sourceRoot: "",
      sources: [sourcePath],
      sourcesContent,
      names: [],
      mappings
    })}\n`
  );
  return mapPath;
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "wphx-canonical-source-map-"));
try {
  const repositoryA = join(temporaryRoot, "checkout-a");
  const repositoryB = join(temporaryRoot, "nested/checkout-b");
  const mapA = writeMap(repositoryA);
  const mapB = writeMap(repositoryB);
  const canonicalA = canonicalSourceMap(mapA, { repositoryRoot: repositoryA });
  const canonicalB = canonicalSourceMap(mapB, { repositoryRoot: repositoryB });
  const recordA = canonicalSourceMapRecord(mapA, { repositoryRoot: repositoryA });
  const recordB = canonicalSourceMapRecord(mapB, { repositoryRoot: repositoryB });

  assert.equal(canonicalA.text, canonicalB.text, "equivalent maps from distinct checkout roots must canonicalize identically");
  assert.equal(recordA.canonical_sha256, recordB.canonical_sha256, "equivalent maps must have identical canonical digests");
  assert.deepEqual(recordA.sources, ["<repo>/fixtures/src/Probe.hx"]);
  assert.equal(recordA.path, "build/debug/lib/Probe.php.map");
  assert.equal(recordA.raw_artifact_present, true);
  assert.equal(recordA.canonical_bytes > 0, true);
  assert.deepEqual(recordA, recordB, "committed source-map records must be checkout-path independent");

  const changedMappings = writeMap(repositoryB, "AAAC");
  const changedMappingRecord = canonicalSourceMapRecord(changedMappings, { repositoryRoot: repositoryB });
  assert.notEqual(recordA.canonical_sha256, changedMappingRecord.canonical_sha256, "mapping changes must change the digest");

  const changedContent = writeMap(repositoryB, "AAAA", ["class Probe { static function main() {} }\n"]);
  const changedContentRecord = canonicalSourceMapRecord(changedContent, { repositoryRoot: repositoryB });
  assert.notEqual(recordA.canonical_sha256, changedContentRecord.canonical_sha256, "source-content changes must change the digest");

  assert.equal(
    canonicalSourcePath(mapA, "", "/opt/haxe/std/php/Boot.hx", { repositoryRoot: repositoryA }),
    "<haxe-std>/php/Boot.hx"
  );
  assert.equal(
    canonicalSourcePath(mapA, "", "/srv/cache/haxe_libraries/sourcemap/1.11.0/src/sourcemap/SourceMap.hx", {
      repositoryRoot: repositoryA
    }),
    "<haxelib>/sourcemap/1.11.0/src/sourcemap/SourceMap.hx"
  );
  assert.equal(
    canonicalSourcePath("C:/work/repo/build/Probe.php.map", "", "c:\\work\\repo\\src\\Probe.hx", {
      repositoryRoot: "C:\\work\\repo"
    }),
    "<repo>/src/Probe.hx"
  );

  assert.deepEqual(findMachineLocalPaths({ package_root: ".", file: "wp-includes/plugin.php" }), []);
  assert.deepEqual(findMachineLocalPaths({ package_root: "/Users/example/private-checkout/package" }), [
    { location: "$.package_root", value: "/Users/example/private-checkout/package" }
  ]);
  assert.deepEqual(findMachineLocalPaths({ package_root: "C:\\Users\\example\\private-checkout\\package" }), [
    { location: "$.package_root", value: "C:\\Users\\example\\private-checkout\\package" }
  ]);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        cross_checkout_digest_equal: true,
        semantic_mapping_change_detected: true,
        semantic_source_content_change_detected: true,
        machine_local_path_guard_passed: true
      },
      null,
      2
    )
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
