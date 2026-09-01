#!/usr/bin/env node
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const isFirefox = process.argv.includes("--firefox");
const outDir = isFirefox ? "dist-firefox" : "dist";
const manifestPath = join(outDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error(`✕ ${outDir}/manifest.json not found. Run \`npm run build${isFirefox ? ":firefox" : ""}\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(
  await (await import("node:fs/promises")).readFile(manifestPath, "utf8"),
);
const version = manifest.version ?? "0.0.0";
const name = isFirefox ? `xcompose-${version}-firefox.zip` : `xcompose-${version}-chrome.zip`;
const outPath = resolve(name);

// Prefer system `zip` if available (Windows has it via Git Bash), fallback to manual via `jszip`? Keep simple: use `zip` command.
try {
  // Check zip exists
  execSync("zip -v", { stdio: "ignore" });
} catch {
  console.error("✕ `zip` CLI not found. On Windows, use Git Bash or WSL, or install 7zip and alias.");
  process.exit(1);
}

console.log(`→ Zipping ${outDir}/ → ${name}`);
try {
  // Use zip with maximum compression, exclude hidden files
  // On Windows, we need to handle path separators
  execSync(`zip -r -9 "${outPath}" . -x "*.DS_Store" -x "*.map"`, {
    cwd: resolve(outDir),
    stdio: "inherit",
  });
  const stat = statSync(outPath);
  console.log(`✓ Wrote ${name} (${(stat.size / 1024).toFixed(1)} KiB)`);
  // Also list contents briefly
  try {
    const out = execSync(`zipinfo -1 "${outPath}" | head -n 20`, { encoding: "utf8" });
    console.log(out.trim());
    const total = execSync(`zipinfo -1 "${outPath}" | wc -l`, { encoding: "utf8" }).trim();
    console.log(`… ${total} files total`);
  } catch {}
} catch (err) {
  console.error("✕ zip failed", err);
  process.exit(1);
}
