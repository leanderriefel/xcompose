import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { build, createServer } from "vite";
import { chromium, firefox } from "playwright";
import webExt from "web-ext";

const directory = await mkdtemp(join(tmpdir(), "xcompose-browser-test-"));
const isChromium = process.argv.includes("--chromium");
let server, runner, context, timeout;
try {
  const baseline = process.argv.includes("--baseline");
  const oldSource = baseline
    ? execFileSync("git", ["show", "v0.2.1:src/lib/editor.ts"], { encoding: "utf8" })
    : null;
  await build({
    configFile: false,
    logLevel: "error",
    plugins: baseline
      ? [
          {
            name: "baseline-editor",
            load(id) {
              if (id.replaceAll("\\", "/").endsWith("/src/lib/editor.ts")) return oldSource;
            },
          },
        ]
      : [],
    build: {
      outDir: directory,
      emptyOutDir: false,
      lib: {
        entry: resolve("tests/firefox/content.ts"),
        name: "FirefoxTest",
        formats: ["iife"],
        fileName: () => "content.js",
      },
    },
  });
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name: "XCompose Firefox regression test",
      version: "1.0",
      browser_specific_settings: { gecko: { id: "regression@xcompose.test" } },
      content_scripts: [
        { matches: ["http://127.0.0.1/*"], js: ["content.js"], run_at: "document_idle" },
      ],
    })
  );
  let reportReady;
  const report = new Promise((resolve, reject) => {
    reportReady = resolve;
    timeout = setTimeout(() => reject(new Error("Firefox content-script test timed out")), 60000);
  });
  // Attach rejection handling while Firefox starts up.
  report.catch(() => {});
  server = await createServer({
    configFile: false,
    logLevel: "error",
    define: { global: "globalThis" },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "test-report",
        configureServer(server) {
          server.middlewares.use("/firefox-test-result", async (request, response) => {
            if (request.method !== "POST") {
              response.statusCode = 405;
              response.end();
              return;
            }
            let body = "";
            for await (const chunk of request) body += chunk;
            reportReady(JSON.parse(body));
            response.end("ok");
          });
        },
      },
    ],
  });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/tests/firefox/composer.html`;
  if (isChromium) {
    context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`],
    });
    await context.pages()[0].goto(url);
  } else {
    const profile = join(directory, "profile");
    await mkdir(profile);
    runner = await webExt.cmd.run(
      {
        sourceDir: directory,
        artifactsDir: directory,
        firefox: process.env.FIREFOX_BINARY || firefox.executablePath(),
        args: ["-headless"],
        firefoxProfile: profile,
        keepProfileChanges: true,
        startUrl: [url],
        noReload: true,
        noInput: true,
      },
      { shouldExitProgram: false }
    );
  }
  const result = await report;
  console.log(JSON.stringify(result, null, 2));
  if (result.error || !result.results?.length || result.results.some(item => !item.pass))
    process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await context?.close();
  if (runner) {
    const closed = new Promise(resolve => runner.registerCleanup(resolve));
    await runner.exit();
    await closed;
  }
  await server?.close();
  // Only the unique temporary directory created above is removed.
  await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
