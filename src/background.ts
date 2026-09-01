import { getConfig } from "./lib/config.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "enhance") {
      const { enhance } = await import("./lib/llm.js");
      return { ok: true, result: await enhance(msg.actionId, msg.text, await getConfig()) };
    }
    if (msg.type === "test") {
      const { enhance } = await import("./lib/llm.js");
      return { ok: true, probe: await enhance("fix-grammar", "hello wrld", msg.cfg ?? (await getConfig())) };
    }
    throw new Error(`Unknown message: ${msg.type}`);
  })()
    .then(sendResponse)
    .catch((e: Error) => sendResponse({ ok: false, error: e.message }));
  return true;
});
