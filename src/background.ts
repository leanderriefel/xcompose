import { getAll } from "./lib/storage.js";
import { callLLM } from "./lib/providers.js";
import type { XComposeMessage } from "./lib/types.js";

chrome.runtime.onMessage.addListener(
  (
    msg: XComposeMessage & Record<string, unknown>,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (resp: unknown) => void
  ) => {
    (async () => {
      if (msg?.type === "XCOMPOSE_ENHANCE") {
        const cfg = await getAll();
        const result = await callLLM({
          actionId: String((msg as { actionId: string }).actionId),
          text: String((msg as { text: string }).text),
          cfg,
        });
        return { ok: true, result } as const;
      }
      if (msg?.type === "XCOMPOSE_TEST") {
        const cfg =
          ((msg as { cfg?: unknown }).cfg as import("./lib/types.js").XComposeConfig) ??
          (await getAll());
        const probe = await callLLM({
          actionId: "fix-grammar",
          text: "hello wrld",
          cfg,
        });
        return { ok: true, probe } as const;
      }
      if (msg?.type === "XCOMPOSE_GET_CONFIG") {
        const cfg = await getAll();
        return { ok: true, cfg } as const;
      }
      throw new Error("Unknown message type: " + String((msg as { type?: unknown })?.type));
    })()
      .then(sendResponse)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error: message });
      });
    return true; // keep channel open
  }
);

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    void getAll().then(cfg => {
      void chrome.storage.local.set({ provider: cfg.provider });
    });
  }
});
