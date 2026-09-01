import type { ActionMeta } from "./types.js";

export const ACTIONS: ActionMeta[] = [
  { id: "fix-grammar", label: "Fix grammar", icon: "✦", desc: "Corrects grammar & spelling" },
  { id: "shorten", label: "Shorten", icon: "◐", desc: "More concise, under 280" },
  { id: "punchier", label: "Punchier", icon: "⚡", desc: "More engaging / viral" },
  { id: "expand", label: "Expand", icon: "⤢", desc: "Add clarity & nuance" },
  { id: "formal", label: "Formal", icon: "◈", desc: "Professional tone" },
  { id: "casual", label: "Casual", icon: "☺", desc: "Friendly tone" },
  { id: "emojify", label: "Emojify", icon: "✿", desc: "Add tasteful emojis" },
];

export const ACTION_MAP: Record<string, ActionMeta> = Object.fromEntries(
  ACTIONS.map(a => [a.id, a])
);
