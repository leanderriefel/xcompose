import {
  ArrowShrinkFreeIcons,
  ArrowTurnBackwardFreeIcons,
  BoltFreeIcons,
  BriefcaseBusinessFreeIcons,
  ExpandParagraphFreeIcons,
  SettingsFreeIcons,
  SmileFreeIcons,
  SpellCheckFreeIcons,
  StickerFreeIcons,
} from "@hugeicons/core-free-icons";

const ICONS = {
  "spell-check": SpellCheckFreeIcons,
  shrink: ArrowShrinkFreeIcons,
  bolt: BoltFreeIcons,
  "expand-paragraph": ExpandParagraphFreeIcons,
  briefcase: BriefcaseBusinessFreeIcons,
  smile: SmileFreeIcons,
  sticker: StickerFreeIcons,
  settings: SettingsFreeIcons,
  undo: ArrowTurnBackwardFreeIcons,
};

export type IconName = keyof typeof ICONS;

const kebab = (s: string) => s.replace(/[A-Z]/g, c => "-" + c.toLowerCase());

export function icon(name: IconName): string {
  const body = (ICONS[name] as [string, Record<string, string>][])
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${kebab(k)}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;
}
