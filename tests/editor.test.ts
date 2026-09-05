import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getText, setText } from "../src/lib/editor";

let editor: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML =
    '<div class="DraftEditor-root"><div contenteditable="true" tabindex="0"></div></div>';
  editor = document.querySelector("[contenteditable]")!;
  editor.textContent = "Original";
  vi.stubGlobal(
    "DataTransfer",
    class {
      value = "";
      setData(_type: string, value: string) {
        this.value = value;
      }
      getData() {
        return this.value;
      }
    }
  );
  vi.stubGlobal(
    "ClipboardEvent",
    class extends Event {
      clipboardData: DataTransfer;
      constructor(type: string, init: ClipboardEventInit) {
        super(type, init);
        this.clipboardData = init.clipboardData!;
      }
    }
  );
  document.execCommand = vi.fn(() => true);
});
afterEach(() => vi.unstubAllGlobals());

describe("draft replacement", () => {
  it("reads every styled fragment in a block", () => {
    editor.innerHTML =
      '<div data-block="true"><span data-offset-key="a">Hello </span><span data-offset-key="b">world</span></div>';
    expect(getText(editor)).toBe("Hello world");
  });
  it("does not paste into a selection the user moved", async () => {
    const paste = vi.fn();
    editor.addEventListener("paste", paste);
    const result = setText(editor, "New");
    getSelection()!.collapseToEnd();
    expect(await result).toBe(false);
    expect(paste).not.toHaveBeenCalled();
  });
  it("preserves blank lines and nonbreaking spaces in Draft blocks", () => {
    editor.innerHTML =
      '<div data-block="true"><span data-offset-key="a">Hi&nbsp;there</span></div><div data-block="true"><span data-offset-key="b"><br></span></div>';
    expect(getText(editor)).toBe("Hi\u00a0there\n");
  });
  it("applies and undoes through the paste handler without native insertion", async () => {
    editor.addEventListener("paste", event => {
      event.preventDefault();
      editor.textContent = (event as ClipboardEvent).clipboardData!.getData("text/plain");
    });
    expect(await setText(editor, "New\ntext")).toBe(true);
    expect(await setText(editor, "Original")).toBe(true);
    expect(document.execCommand).not.toHaveBeenCalled();
  });
  it("does not reapply a handled partial paste", async () => {
    editor.addEventListener("paste", event => {
      event.preventDefault();
      editor.textContent = "Partial";
    });
    expect(await setText(editor, "New")).toBe(false);
    expect(document.execCommand).not.toHaveBeenCalled();
  });
  it("never uses the corrupting native fallback on Draft.js", async () => {
    expect(await setText(editor, "New")).toBe(false);
    expect(editor.textContent).toBe("Original");
    expect(document.execCommand).not.toHaveBeenCalled();
  });
  it("protects edits made while selection is settling", async () => {
    const paste = vi.fn();
    editor.addEventListener("paste", paste);
    const result = setText(editor, "New");
    editor.textContent = "User typing";
    expect(await result).toBe(false);
    expect(paste).not.toHaveBeenCalled();
  });
  it("does not steal focus back from another field", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    const paste = vi.fn();
    editor.addEventListener("paste", paste);
    const result = setText(editor, "New");
    input.focus();
    expect(await result).toBe(false);
    expect(paste).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
  it("fails safely when a composer is removed", async () => {
    const result = setText(editor, "New");
    editor.remove();
    expect(await result).toBe(false);
    expect(document.execCommand).not.toHaveBeenCalled();
  });
  it("does not wait for animation frames in a hidden tab", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    editor.addEventListener("paste", event => {
      event.preventDefault();
      editor.textContent = "New";
    });
    expect(await setText(editor, "New")).toBe(true);
  });
});
