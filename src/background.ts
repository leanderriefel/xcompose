import { PROVIDERS, getConfig } from "./lib/config.js";
import { enhance } from "./lib/llm.js";

const providerOrigin = (provider: "openrouter" | "opencode-go") =>
  provider === "openrouter" ? "https://openrouter.ai/*" : "https://opencode.ai/*";

async function requireProviderPermission(provider: "openrouter" | "opencode-go") {
  if (!(await chrome.permissions.contains({ origins: [providerOrigin(provider)] }))) {
    throw new Error("Provider access is not allowed. Open Settings and click Test.");
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "open-options") {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    }
    if (msg.type === "enhance") {
      const cfg = await getConfig();
      await requireProviderPermission(cfg.provider);
      return { ok: true, result: await enhance(msg.actionId, msg.text, cfg) };
    }
    if (msg.type === "get-go-models") {
      await requireProviderPermission("opencode-go");
      const response = await fetch(`${PROVIDERS["opencode-go"].baseUrl}/models`);
      if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
      const payload = (await response.json()) as { data?: { id?: unknown }[] };
      return {
        ok: true,
        models: payload.data
          ?.map(item => item.id)
          .filter((id): id is string => typeof id === "string"),
      };
    }
    if (msg.type === "test") {
      const cfg = msg.cfg ?? (await getConfig());
      await requireProviderPermission(cfg.provider);
      return {
        ok: true,
        probe: await enhance("fix-grammar", "hello wrld", cfg),
      };
    }
    throw new Error(`Unknown message: ${String(msg?.type)}`);
  })()
    .then(sendResponse)
    .catch((e: unknown) =>
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
    );
  return true;
});
