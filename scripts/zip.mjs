#!/usr/bin/env node
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { zipSync, unzipSync } from "fflate";

function archive(directory, output, paths = readdirSync(directory)) {
  const files = {};
  function add(relative) {
    const entries = readdirSync(join(directory, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${entry.name}`);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) add(name);
      else if (entry.isFile()) files[name] = readFileSync(join(directory, name));
    }
  }
  for (const path of paths.sort()) {
    const entry = readdirSync(directory, { withFileTypes: true }).find(
      entry => entry.name === path
    );
    if (!entry || entry.isSymbolicLink()) throw new Error(`Missing or unsafe input: ${path}`);
    if (entry.isDirectory()) add(path);
    else files[path] = readFileSync(join(directory, path));
  }
  const bytes = zipSync(files, { level: 9, mtime: new Date("1980-01-01T00:00:00Z") });
  const extracted = unzipSync(bytes);
  for (const [name, content] of Object.entries(files)) {
    if (!Buffer.from(extracted[name]).equals(content))
      throw new Error(`ZIP verification failed: ${name}`);
  }
  writeFileSync(output, bytes);
  console.log(
    `${output} (${(bytes.length / 1024).toFixed(1)} KiB, ${Object.keys(files).length} files)`
  );
}

const source = process.argv.includes("--source");
const firefox = process.argv.includes("--firefox");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
mkdirSync("packages", { recursive: true });
if (source) {
  // Explicit allowlist: never include credentials, dependencies, or build outputs.
  archive(resolve("."), `packages/xcompose-${version}-source.zip`, [
    "src",
    "icons",
    "scripts",
    "tests",
    "manifest.json",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "vite.config.ts",
    "vitest.config.ts",
    "tsconfig.json",
    ".editorconfig",
    ".oxfmtrc.json",
    ".oxlintrc.json",
    "README.md",
    "RELEASING.md",
    "CHANGELOG.md",
    "LICENSE",
    "PRIVACY.md",
  ]);
} else {
  const directory = firefox ? "dist-firefox" : "dist";
  const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
  if (manifest.version !== version)
    throw new Error("Stale build: manifest and package versions differ");
  if (firefox ? !manifest.background.scripts : !manifest.background.service_worker) {
    throw new Error("Wrong browser manifest");
  }
  archive(resolve(directory), `packages/xcompose-${version}-${firefox ? "firefox" : "chrome"}.zip`);
}
