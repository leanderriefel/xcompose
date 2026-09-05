import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startGeneration } from "../src/lib/generation";

let editor: HTMLElement;
let resolveRequest: (value: unknown) => void;
let rejectRequest: (error: Error) => void;
let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div contenteditable="true">Original draft</div>';
  editor = document.body.firstElementChild as HTMLElement;
  send = vi.fn(message =>
    message.type === "enhance"
      ? new Promise((resolve, reject) => {
          resolveRequest = resolve;
          rejectRequest = reject;
        })
      : Promise.resolve({ ok: true })
  );
  vi.stubGlobal("chrome", { runtime: { sendMessage: send } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("locks editing during generation and restores it on success", async () => {
  const operation = startGeneration(editor, "fix-grammar", "Original draft");
  expect(editor.getAttribute("contenteditable")).toBe("false");
  for (const type of ["beforeinput", "paste", "cut", "drop"])
    expect(editor.dispatchEvent(new Event(type, { cancelable: true }))).toBe(false);
  expect(
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", cancelable: true }))
  ).toBe(false);
  resolveRequest({ ok: true, result: "Corrected" });
  expect(await operation.response).toEqual({ ok: true, result: "Corrected" });
  expect(editor.getAttribute("contenteditable")).toBe("true");
  expect(editor.hasAttribute("aria-busy")).toBe(false);
  expect(editor.dispatchEvent(new Event("paste", { cancelable: true }))).toBe(true);
});
it("Cancel unlocks promptly, aborts the matching request, and ignores a late response", async () => {
  const operation = startGeneration(editor, "fix-grammar", "Original draft");
  const outcome = expect(operation.response).rejects.toThrow("Cancelled");
  operation.cancel();
  await outcome;
  expect(editor.getAttribute("contenteditable")).toBe("true");
  expect(send).toHaveBeenLastCalledWith({
    type: "cancel-enhance",
    requestId: send.mock.calls[0][0].requestId,
  });
  resolveRequest({ ok: true, result: "Too late" });
  await Promise.resolve();
  expect(editor.textContent).toBe("Original draft");
});
it("unlocks after 60 seconds even if the worker never responds", async () => {
  const operation = startGeneration(editor, "fix-grammar", "Original draft");
  const outcome = expect(operation.response).rejects.toThrow("Timed out");
  await vi.advanceTimersByTimeAsync(60_000);
  await outcome;
  expect(editor.getAttribute("contenteditable")).toBe("true");
  expect(editor.textContent).toBe("Original draft");
});
it("unlocks if the worker rejects or is invalidated", async () => {
  const operation = startGeneration(editor, "fix-grammar", "Original draft");
  const outcome = expect(operation.response).rejects.toThrow("Worker unavailable");
  rejectRequest(new Error("Worker unavailable"));
  await outcome;
  expect(editor.getAttribute("contenteditable")).toBe("true");
});
it("unlocks when the provider returns an error response", async () => {
  const operation = startGeneration(editor, "fix-grammar", "Original draft");
  resolveRequest({ ok: false, error: "Provider error" });
  await operation.response;
  expect(editor.getAttribute("contenteditable")).toBe("true");
});
