import { afterEach, expect, it, vi } from "vitest";

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
