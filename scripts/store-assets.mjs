#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const source = resolve("store-assets/source");
const output = resolve("packages/store-assets");

const files = {
  compose: resolve(source, "Screenshot 2026-09-02 000159.png"),
  settings: resolve(source, "Screenshot 2026-09-02 000005.png"),
  icon: resolve(source, "Untitled-1.png"),
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Store asset not found: ${file}`);
}

mkdirSync(output, { recursive: true });
mkdirSync(resolve("icons"), { recursive: true });

function exportPng(input, filter, outputFile) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vf",
      filter,
      "-frames:v",
      "1",
      "-update",
      "1",
      outputFile,
    ],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error(`Could not create ${outputFile}`);
}

// The compose source is narrower than the stores' 16:10 screenshot frame.
// Pad it instead of cutting off the menu, then upscale it with high-quality filtering.
exportPng(
  files.compose,
  "pad=1074:671:84:0:color=black,scale=1280:800:flags=lanczos",
  resolve(output, "screenshot-compose-1280x800.png")
);
exportPng(
  files.settings,
  "crop=1280:800:320:0,scale=1280:800:flags=lanczos",
  resolve(output, "screenshot-settings-1280x800.png")
);
exportPng(files.icon, "scale=128:128:flags=lanczos", resolve(output, "icon-128.png"));
exportPng(
  files.icon,
  "crop=1000:636:0:182,scale=440:280:flags=lanczos",
  resolve(output, "chrome-promo-440x280.png")
);

for (const size of [16, 32, 48, 128]) {
  exportPng(files.icon, `scale=${size}:${size}:flags=lanczos`, resolve("icons", `icon${size}.png`));
}

console.log(`Store assets written to ${output}`);
