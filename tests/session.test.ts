import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("uses one persisted ID for concurrent first requests", async () => {
  const get = vi.fn(async () => ({}));
  const set = vi.fn(async () => {});
  vi.stubGlobal("chrome", { storage: { local: { get, set } } });
  const { getGoSessionId } = await import("../src/lib/llm");
  const ids = await Promise.all(Array.from({ length: 10 }, () => getGoSessionId()));
  expect(new Set(ids).size).toBe(1);
  expect(get).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalledExactlyOnceWith({ opencodeSessionId: ids[0] });
});
it("reuses the stored session after a worker restart", async () => {
  const set = vi.fn();
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({ opencodeSessionId: "persisted-id" }), set } },
  });
  const { getGoSessionId } = await import("../src/lib/llm");
  expect(await getGoSessionId()).toBe("persisted-id");
  expect(set).not.toHaveBeenCalled();
});
it("keeps an ephemeral ID stable if storage fails", async () => {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => {
          throw Error();
        },
        set: async () => {
          throw Error();
        },
      },
    },
  });
  const { getGoSessionId } = await import("../src/lib/llm");
  expect(await getGoSessionId()).toBe(await getGoSessionId());
});
