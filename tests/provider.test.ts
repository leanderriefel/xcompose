import { afterEach, expect, it, vi } from "vitest";
import { getConfig } from "../src/lib/config";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it.each(["gpt-test", "minimax-test", "glm-test"])(
  "sends the session header on actual %s adapter requests",
  async model => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async () => ({
            opencodeSessionId: "test-session",
            providerSettings: { "opencode-go": { apiKey: "test-key", model } },
          }),
          set: async () => {},
        },
      },
    });
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Intentional test response" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetcher);
    const { enhance } = await import("../src/lib/llm");
    await expect(enhance("fix-grammar", "hello", await getConfig())).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/opencode\.ai\/zen\/go\/v1\//);
    expect(new Headers(init.headers).get("x-opencode-session")).toBe("test-session");
  }
);
