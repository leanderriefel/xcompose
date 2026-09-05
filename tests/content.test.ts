import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/icons.js", () => ({
  icon: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"),
}));

afterEach(async () => {
  document.documentElement.dataset.xcomposeOwner = "finished";
  document.body.append(document.createElement("div"));
  await new Promise(resolve => setTimeout(resolve, 10));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("keeps one owner and cleans up detached menus when editors share a toolbar", async () => {
  document.body.innerHTML =
    '<main><div role="textbox" contenteditable="true" id="a">First</div><div role="textbox" contenteditable="true" id="b">Second</div><div data-testid="toolBar"></div></main>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "isContentEditable", {
    configurable: true,
    get() {
      return this.getAttribute("contenteditable") === "true";
    },
  });
  let changed: (changes: unknown, area: string) => void;
  const get = vi.fn(async () => ({ enabled: ["fix-grammar"] }));
  vi.stubGlobal("chrome", {
    storage: {
      local: { get },
      onChanged: {
        addListener: (fn: typeof changed) => {
          changed = fn;
        },
      },
    },
  });
  await import("../src/content");
  await vi.waitFor(() => expect(document.querySelectorAll(".xcompose-bar")).toHaveLength(1));
  const first = document.querySelector(".xcompose-bar");
  document.querySelector("#a")!.remove();
  await vi.waitFor(() => expect(first!.isConnected).toBe(false));
  expect(document.querySelectorAll(".xcompose-bar")).toHaveLength(1);
  expect(document.querySelectorAll(".xcompose-dropdown")).toHaveLength(1);
  get.mockResolvedValue({ enabled: ["shorten"] });
  changed!({ enabled: {} }, "local");
  await vi.waitFor(() => expect(document.querySelector('[data-action="shorten"]')).not.toBeNull());
  expect(document.querySelectorAll(".xcompose-bar")).toHaveLength(1);
  expect(document.querySelectorAll(".xcompose-dropdown")).toHaveLength(1);
});

it("keeps Cancel in the dropdown and disables generation actions until cancellation", async () => {
  vi.resetModules();
  document.body.innerHTML =
    '<main><div role="textbox" contenteditable="true">Test draft</div><div data-testid="toolBar"></div></main>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "isContentEditable", {
    configurable: true,
    get() {
      return this.getAttribute("contenteditable") === "true";
    },
  });
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } },
    runtime: {
      sendMessage: (message: { type: string }) =>
        message.type === "enhance" ? new Promise(() => {}) : Promise.resolve({ ok: true }),
    },
  });
  await import("../src/content");
  await vi.waitFor(() => expect(document.querySelector(".xcompose-trigger")).not.toBeNull());
  const editor = document.querySelector('[role="textbox"]')!;
  const trigger = document.querySelector<HTMLButtonElement>(".xcompose-trigger")!;
  const menu = document.querySelector<HTMLElement>(".xcompose-dropdown")!;
  const cancel = menu.querySelector<HTMLButtonElement>(".xcompose-cancel")!;
  trigger.click();
  menu.querySelector<HTMLButtonElement>('[data-action="fix-grammar"]')!.click();
  expect(editor.getAttribute("contenteditable")).toBe("false");
  expect(trigger.disabled).toBe(false);
  expect(document.querySelector(".xcompose-bar .xcompose-cancel")).toBeNull();
  trigger.click();
  expect(menu.hidden).toBe(false);
  expect(cancel.hidden).toBe(false);
  expect(
    [...menu.querySelectorAll<HTMLButtonElement>("[data-action]")].every(button => button.disabled)
  ).toBe(true);
  cancel.click();
  await vi.waitFor(() => expect(editor.getAttribute("contenteditable")).toBe("true"));
  expect(cancel.hidden).toBe(true);
  expect(
    [...menu.querySelectorAll<HTMLButtonElement>("[data-action]")].every(button => !button.disabled)
  ).toBe(true);
  expect(editor.textContent).toBe("Test draft");
});
