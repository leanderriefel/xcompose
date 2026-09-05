import React from "react";
import ReactDOM from "react-dom";
import Draft from "draft-js";
import "draft-js/dist/Draft.css";
import "../src/content.css";
import { getText, setText } from "../src/lib/editor.ts";

const { Editor, EditorState, ContentState } = Draft;
const states = [];
function Composer({ index }) {
  const [state, update] = React.useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText(index ? "Second composer" : "hello wrld\n\nsecond line")
    )
  );
  states[index] = state;
  return React.createElement(
    "section",
    null,
    React.createElement("h2", null, `Composer ${index + 1}`),
    React.createElement(Editor, {
      editorState: state,
      onChange: update,
      placeholder: "Write a draft",
    }),
    React.createElement(
      "div",
      { "data-testid": "toolBar" },
      React.createElement("button", { type: "button" }, "Local test toolbar")
    )
  );
}
ReactDOM.render(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composer, { index: 0 }),
    React.createElement(Composer, { index: 1 })
  ),
  document.getElementById("root")
);

window.chrome = {
  storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } },
  runtime: {
    sendMessage: async message => {
      if (message.type !== "enhance") return { ok: true };
      await new Promise(resolve => setTimeout(resolve, 100));
      return { ok: true, result: message.text.replace("hello wrld", "Hello world.") };
    },
  },
};
await import("../src/content.ts");

document.getElementById("checks").onclick = async () => {
  const results = document.getElementById("results");
  results.textContent = "Running…";
  const editor = document.querySelector('[contenteditable="true"]');
  const original = getText(editor);
  const lines = [];
  for (const text of [
    "New paragraph.\n\nAnother line.",
    original,
    "Emoji 👋 café\n",
    "Repeated replacement",
    original,
  ]) {
    const applied = await setText(editor, text);
    const stateText = states[0].getCurrentContent().getPlainText("\n");
    const pass = applied && getText(editor) === text && stateText === text;
    lines.push(
      `${pass ? "PASS" : "FAIL"}: ${JSON.stringify(text)} — DOM=${JSON.stringify(getText(editor))}, EditorState=${JSON.stringify(stateText)}`
    );
  }
  const bar = document.querySelector(".xcompose-bar");
  document.getElementById(bar.dataset.menuId).querySelector('[data-action="fix-grammar"]').click();
  editor.blur();
  editor.focus(); // Reproduce focusing X's read-only composer while generating.
  lines.push(
    `${editor.getAttribute("contenteditable") === "false" ? "PASS" : "FAIL"}: locked during generation`
  );
  await new Promise(resolve => setTimeout(resolve, 250));
  const expected = original.replace("hello wrld", "Hello world.");
  lines.push(
    `${getText(editor) === expected && states[0].getCurrentContent().getPlainText("\n") === expected ? "PASS" : "FAIL"}: focus during generation still replaces the entire draft`
  );
  lines.push(
    `${editor.getAttribute("contenteditable") === "true" ? "PASS" : "FAIL"}: unlocked after generation`
  );
  lines.push(
    `${document.querySelectorAll(".xcompose-trigger").length === 2 ? "PASS" : "FAIL"}: one toolbar per composer`
  );
  lines.push(
    `${states[1].getCurrentContent().getPlainText() === "Second composer" ? "PASS" : "FAIL"}: second composer unchanged`
  );
  results.textContent = lines.join("\n");
};
