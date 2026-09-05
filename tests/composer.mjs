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
    sendMessage: async message => ({
      ok: true,
      result: message.text.replace("hello wrld", "Hello world."),
    }),
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
  lines.push(
    `${document.querySelectorAll(".xcompose-trigger").length === 2 ? "PASS" : "FAIL"}: one toolbar per composer`
  );
  lines.push(
    `${states[1].getCurrentContent().getPlainText() === "Second composer" ? "PASS" : "FAIL"}: second composer unchanged`
  );
  results.textContent = lines.join("\n");
};
