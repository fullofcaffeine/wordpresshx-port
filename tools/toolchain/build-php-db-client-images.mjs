#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.9",
  external_ref: "WPHX-305.09",
  title: "Add locked PHP DB-client image for live DB gates"
};
const OUT = "manifests/toolchain/wphx-305-09-php-db-client-images.v1.json";
const RECEIPT = "receipts/toolchain/wphx-305-09-php-db-client-images.v1.json";
const RECORDED_AT = "2026-06-21T04:05:00.000Z";
const CLIENT_IDS = ["php_8_4_db_client", "php_8_5_db_client"];

function command(commandName, commandArgs, options = {}) {
  const output = execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: options.encoding ?? "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 80
  });
  return typeof output === "string" ? output.trim() : "";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function localImageRef(image) {
  return `${image.repository}:${image.tag}`;
}

function buildContext(dockerfile) {
  return dirname(dockerfile);
}

function assertLockMatchesDockerfile(id, image) {
  if (!existsSync(image.dockerfile)) {
    throw new Error(`${id} Dockerfile is missing: ${image.dockerfile}`);
  }
  const actual = sha256File(image.dockerfile);
  if (actual !== image.dockerfile_sha256) {
    throw new Error(`${id} Dockerfile digest ${actual} does not match toolchain lock ${image.dockerfile_sha256}`);
  }
  const dockerfileText = readFileSync(image.dockerfile, "utf8");
  if (!dockerfileText.includes(image.base_index_digest)) {
    throw new Error(`${id} Dockerfile does not pin base digest ${image.base_index_digest}`);
  }
}

function buildImage(id, image) {
  const ref = localImageRef(image);
  command("docker", ["build", "--pull=false", "--label", `wordpresshx.client-image-id=${id}`, "-t", ref, "-f", image.dockerfile, buildContext(image.dockerfile)], {
    stdio: ["ignore", "inherit", "inherit"]
  });
}

function verifyImage(image) {
  const code = `
    $extensions = array('mysqli', 'pdo_mysql');
    $loaded = array();
    foreach ($extensions as $extension) {
      $loaded[$extension] = extension_loaded($extension);
    }
    echo json_encode(array(
      'phpVersion' => PHP_VERSION,
      'loadedExtensions' => $loaded,
      'mysqliClientInfo' => function_exists('mysqli_get_client_info') ? mysqli_get_client_info() : null,
      'pdoDrivers' => class_exists('PDO') ? PDO::getAvailableDrivers() : array()
    ), JSON_UNESCAPED_SLASHES) . PHP_EOL;
  `;
  const result = JSON.parse(command("docker", ["run", "--rm", localImageRef(image), "php", "-r", code]));
  for (const extension of image.required_extensions) {
    if (result.loadedExtensions?.[extension] !== true) {
      throw new Error(`${localImageRef(image)} does not load required PHP extension ${extension}`);
    }
  }
  if (!Array.isArray(result.pdoDrivers) || !result.pdoDrivers.includes("mysql")) {
    throw new Error(`${localImageRef(image)} does not expose the PDO mysql driver`);
  }
  return result;
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run php:db-client-images`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

if (!command("docker", ["info", "--format", "{{.ServerVersion}}"])) {
  console.error(JSON.stringify({ status: "failed", error: "docker server unavailable; PHP DB-client image checks require Docker" }, null, 2));
  process.exit(1);
}

const lock = readJson("toolchain.lock.json");
const clients = CLIENT_IDS.map((id) => {
  const image = lock.container_images[id];
  if (!image) {
    throw new Error(`toolchain.lock.json is missing container_images.${id}`);
  }
  assertLockMatchesDockerfile(id, image);
  buildImage(id, image);
  return {
    id,
    image,
    verification: verifyImage(image)
  };
});

const manifest = {
  schema: "wphx.php-db-client-images.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/toolchain/build-php-db-client-images.mjs",
  inputs: {
    toolchain_lock: inputRecord("toolchain.lock.json"),
    dockerfiles: clients.map((client) => inputRecord(client.image.dockerfile))
  },
  evidence_class: "runtime_toolchain_lock",
  artifact_scope: "php_db_client_runtime",
  images: clients.map((client) => {
    const base = lock.container_images[client.image.base_image];
    return {
      id: client.id,
      local_reference: localImageRef(client.image),
      dockerfile: client.image.dockerfile,
      dockerfile_sha256: client.image.dockerfile_sha256,
      base_image: client.image.base_image,
      base_reference: `${base.repository}@${base.index_digest}`,
      base_index_digest: client.image.base_index_digest,
      base_linux_amd64_digest: base.linux_amd64_digest,
      base_linux_arm64_digest: base.linux_arm64_digest,
      required_extensions: client.image.required_extensions,
      verification: client.verification
    };
  }),
  validation_result: {
    status: "passed",
    image_count: clients.length,
    required_extensions: ["mysqli", "pdo_mysql"],
    build_inputs_locked: true,
    extensions_loaded: true,
    pdo_mysql_driver_available: true
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-305-09-php-db-client-images",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "PHP DB-client image build and extension verification manifest"
    },
    {
      path: "toolchain.lock.json",
      role: "locked PHP DB-client image build inputs"
    },
    ...clients.map((client) => ({
      path: client.image.dockerfile,
      role: `${client.id} pinned Dockerfile`
    })),
    {
      path: "tools/toolchain/build-php-db-client-images.mjs",
      role: "PHP DB-client image builder and check-mode validator"
    }
  ],
  verification_commands: ["npm run php:db-client-images", "npm run php:db-client-images:check", "npm run beads:validate", "npm run receipts:validate"],
  validation_result: manifest.validation_result
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(RECEIPT, receiptText);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      receipt: RECEIPT,
      images: clients.map((client) => client.id)
    },
    null,
    2
  )
);
