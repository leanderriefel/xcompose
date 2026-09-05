#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
if (pkg.version !== manifest.version)
  throw new Error("package.json and manifest.json versions differ");
const requested = process.argv[2];
if (requested) {
  const parts = pkg.version.split(".").map(Number);
  const index = ["major", "minor", "patch"].indexOf(requested);
  if (index >= 0) {
    parts[index]++;
    for (let i = index + 1; i < parts.length; i++) parts[i] = 0;
  }
  const next = index >= 0 ? parts.join(".") : requested;
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(next) ||
    next.split(".").some(part => Number(part) > 65535)
  )
    throw new Error("Use patch, minor, major, or a numeric x.y.z version");
  const old = pkg.version.split(".").map(Number);
  const changed = next
    .split(".")
    .map(Number)
    .findIndex((part, i) => part !== old[i]);
  if (changed < 0 || Number(next.split(".")[changed]) < old[changed])
    throw new Error("New version must increase");
  pkg.version = manifest.version = next;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
}
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run through pnpm: pnpm release patch");
const standalone = /\.exe$/i.test(pnpm);
const result = spawnSync(
  standalone ? pnpm : process.execPath,
  [...(standalone ? [] : [pnpm]), "run", "package"],
  { stdio: "inherit" }
);
if (result.status !== 0) process.exit(result.status || 1);
const files = readdirSync("packages")
  .filter(name => name.startsWith(`xcompose-${pkg.version}-`) && name.endsWith(".zip"))
  .sort();
const sums = files
  .map(
    name =>
      `${createHash("sha256")
        .update(readFileSync(`packages/${name}`))
        .digest("hex")}  ${name}`
  )
  .join("\n");
writeFileSync(`packages/xcompose-${pkg.version}-SHA256SUMS.txt`, `${sums}\n`);
console.log(
  `\nRelease ${pkg.version} verified. Upload Chrome and Firefox ZIPs to their dashboards, and the source ZIP to Mozilla.\nSee RELEASING.md for submission and GitHub release steps.`
);
