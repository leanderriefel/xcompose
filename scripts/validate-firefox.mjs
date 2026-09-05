import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  [
    "node_modules/web-ext/bin/web-ext.js",
    "lint",
    "--source-dir",
    "dist-firefox",
    "--output",
    "json",
  ],
  { encoding: "utf8" }
);
if (result.error) throw result.error;
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  throw new Error(`Firefox validator failed: ${result.stderr || result.stdout}`);
}
// Reviewed bundled-library warnings; never blanket-ignore new warnings.
const known = [
  { code: "UNSAFE_VAR_ASSIGNMENT", file: /^assets\/web-[\w-]+\.js$/, remaining: 1 }, // Solid's static template factory.
  { code: "DANGEROUS_EVAL", file: /^assets\/background\.ts-[\w-]+\.js$/, remaining: 1 }, // Zod CSP probe; jitless enabled in llm.ts.
];
const unexpected = report.warnings.filter(warning => {
  const allowed = known.find(
    item => item.code === warning.code && item.file.test(warning.file) && item.remaining > 0
  );
  if (!allowed) return true;
  allowed.remaining--;
  return false;
});
console.log(
  `Firefox: ${report.errors.length} errors, ${report.warnings.length} reviewed dependency warnings, ${unexpected.length} unexpected warnings.`
);
if (result.status !== 0 || report.errors.length || unexpected.length) {
  console.error(JSON.stringify({ errors: report.errors, unexpectedWarnings: unexpected }, null, 2));
  process.exit(1);
}
