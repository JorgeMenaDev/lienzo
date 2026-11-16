// A reference to a point on a screen, to paste to an agent in chat, like:
//   example/now (designs/example/now.tsx) · button "Ridge Loop · Pine Valley · 8.4 km" · 272×65 at (16, 302) · http://localhost:3000/example?screen=now&pin=40,320 · note: make this card taller
// With a device chosen in the menu, it says so (`· as desktop 1440×900`) and the URL opens that view.
// The app builds one on ⌥-click; `bun run lienzo ref` builds one without the element part.
import { screenPath, SIZES, type SizePreset } from "./screens";

/** A point in a screen's own CSS pixels, from its top-left corner, the same at any zoom. */
export type Point = { x: number; y: number };

/** The element pointed at: its tag, its text, and its box in the screen's own pixels. */
export type PointedElement = Point & { tag: string; text: string; width: number; height: number };

export type Reference = {
  /** Where the app runs, like `http://localhost:3000`. */
  origin: string;
  page: string;
  screen: string;
  point: Point;
  element?: PointedElement;
  /** The device the screen was shown as, when one was chosen. */
  device?: SizePreset;
  note?: string;
};

const TEXT_MAX = 60;

export const designFile = (page: string, screen: string) => `designs/${page}/${screen}.tsx`;

/** The canvas URL that selects the screen, shows it as `device` if given, and draws a marker at `point`. */
export const pinUrl = (origin: string, page: string, screen: string, point: Point, device?: SizePreset) =>
  `${origin}/${page}?screen=${screen}${device ? `&device=${device}` : ""}&pin=${Math.round(point.x)},${Math.round(point.y)}`;

/** `&pin=16,302` as a point, or `null` when the value is missing or isn't two whole numbers. */
export function parsePin(value: string | null): Point | null {
  const match = value === null ? null : /^(\d+),(\d+)$/.exec(value);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/** Whitespace collapsed to one line, cut to 60 characters. */
function clip(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > TEXT_MAX ? `${line.slice(0, TEXT_MAX - 1)}…` : line;
}

/** One line: screen and file, then the element and the device (if any), the pin URL and the note (if any), joined by ` · `. */
export function formatReference({ origin, page, screen, point, element, device, note }: Reference): string {
  const parts = [`${screenPath(page, screen)} (${designFile(page, screen)})`];
  if (element) {
    const text = clip(element.text);
    const round = Math.round;
    parts.push(
      text ? `${element.tag} "${text}"` : element.tag,
      `${round(element.width)}×${round(element.height)} at (${round(element.x)}, ${round(element.y)})`,
    );
  }
  if (device) parts.push(`as ${device} ${SIZES[device].width}×${SIZES[device].height}`);
  parts.push(pinUrl(origin, page, screen, point, device));
  const said = note?.replace(/\s+/g, " ").trim();
  if (said) parts.push(`note: ${said}`);
  return parts.join(" · ");
}
