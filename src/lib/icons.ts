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

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of ICONS[name] as [string, Record<string, string>][]) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== "key") element.setAttribute(kebab(key), value);
    }
    svg.append(element);
  }
  return svg;
}
