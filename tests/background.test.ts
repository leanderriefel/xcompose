import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enhance: vi.fn() }));
vi.mock("../src/lib/llm.js", () => ({
  enhance: mocks.enhance,
  getGoSessionId: async () => "session",
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("cancels the provider request only for the originating tab and frame", async () => {
  let listener: (...args: any[]) => void;
  let providerSignal: AbortSignal | undefined;
  mocks.enhance.mockImplementation(
    (_action, _text, _cfg, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        providerSignal = signal;
        signal.addEventListener("abort", () => reject(new Error("Cancelled")));
      })
  );
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({}) } },
    permissions: { contains: async () => true },
    runtime: {
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
  });
  await import("../src/background");
  const send = (message: unknown, tabId = 1) =>
    new Promise(resolve => listener(message, { tab: { id: tabId }, frameId: 0 }, resolve));
  const request = send({
    type: "enhance",
    requestId: "request-1",
    actionId: "fix-grammar",
    text: "Test",
  });
  await vi.waitFor(() => expect(providerSignal).toBeDefined());
  await send({ type: "cancel-enhance", requestId: "request-1" }, 2);
  expect(providerSignal!.aborted).toBe(false);
  await send({ type: "cancel-enhance", requestId: "request-1" });
  expect(providerSignal!.aborted).toBe(true);
  expect(await request).toEqual({ ok: false, error: "Cancelled" });
});
