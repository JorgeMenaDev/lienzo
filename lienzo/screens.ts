// What a design is: pages of screens, their sizes and where they sit on the canvas.
// Shared by the app, the `lienzo` CLI and the design check.
import type { ComponentType } from "react";

export const SIZES = {
  iphone: { width: 402, height: 874 },
  android: { width: 412, height: 917 },
  desktop: { width: 1440, height: 900 },
} as const;

export type SizePreset = keyof typeof SIZES;
export type Size = { width: number; height: number };

/** The Device menu's choices, in the order `D` cycles them; `null` is "As designed", each file's own size. */
export const DEVICES = [null, "iphone", "android", "desktop"] as const;
export type Device = (typeof DEVICES)[number];
export const DEVICE_NAMES: Record<SizePreset, string> = { iphone: "iPhone", android: "Android", desktop: "Desktop" };

/** What every screen file exports as `meta`. */
export type ScreenMeta = {
  name: string;
  size: SizePreset | Size;
  /** Position on the canvas. Screens without one go left to right after the placed ones. */
  x?: number;
  y?: number;
  /** Order in the automatic layout and the sidebar; lower first, then by id. */
  order?: number;
};

/** What a page's optional `_page.ts` exports as `page`. */
export type PageMeta = { name: string };

export type ScreenModule = { default: ComponentType; meta: ScreenMeta };

export type Screen = {
  page: string;
  id: string;
  meta: ScreenMeta;
  Component: ComponentType;
};

export type Frame = Size & { x: number; y: number };

const GAP = 80;

/** Lowercase words joined by `-`: the shape of every page and screen id. */
export const isSlug = (id: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

export const isPreset = (size: unknown): size is SizePreset =>
  typeof size === "string" && Object.hasOwn(SIZES, size);

export const sizeOf = (size: ScreenMeta["size"]): Size => (isPreset(size) ? SIZES[size] : size);

/** Phone presets have the screen's rounded corners, on the canvas and in Play; other sizes are square. */
const CORNERS: Partial<Record<SizePreset, number>> = { iphone: 55, android: 36 };
export const cornerOf = (size: ScreenMeta["size"]) => (isPreset(size) ? (CORNERS[size] ?? 0) : 0);

/** `sign-in` → `Sign in`: the name of a page or screen that doesn't give one. */
export const titleOf = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");

/** `example/now`: how `Go` and the URL name a screen. */
export const screenPath = (page: string, id: string) => `${page}/${id}`;

/** `designs/<page>/<screen>.tsx` to its page and screen ids. Files starting with `_` are helpers, not screens. */
export function parseDesignPath(path: string): { page: string; id: string } | null {
  const match = /(?:^|\/)designs\/([^/]+)\/([^/]+)\.tsx$/.exec(path);
  if (!match || match[1].startsWith("_") || match[2].startsWith("_")) return null;
  return { page: match[1], id: match[2] };
}

export const byOrder = (a: { id: string; meta: ScreenMeta }, b: { id: string; meta: ScreenMeta }) =>
  (a.meta.order ?? Infinity) - (b.meta.order ?? Infinity) || a.id.localeCompare(b.id);

/** The size a screen shows at: the device's when one is chosen, else its file's. */
export const sizeAs = (meta: ScreenMeta, device: Device) => device ?? meta.size;

/**
 * Places each screen of a page on the canvas. Screens with `x` and `y` keep them;
 * the rest form a row, left to right, starting right of the placed ones.
 * With a `device`, every screen takes its size and joins the row, so frames never overlap.
 * Expects screens already sorted with `byOrder`.
 */
export function layout(screens: readonly { meta: ScreenMeta }[], device: Device = null): Frame[] {
  if (device) return layout(screens.map(({ meta }) => ({ meta: { ...meta, size: device, x: undefined, y: undefined } })));
  const placedRight = screens.flatMap(({ meta }) =>
    meta.x !== undefined && meta.y !== undefined ? [meta.x + sizeOf(meta.size).width] : [],
  );
  let x = placedRight.length ? Math.max(...placedRight) + GAP : 0;
  return screens.map(({ meta }) => {
    const size = sizeOf(meta.size);
    if (meta.x !== undefined && meta.y !== undefined) return { ...size, x: meta.x, y: meta.y };
    const frame = { ...size, x, y: 0 };
    x += size.width + GAP;
    return frame;
  });
}

/** The box around every frame, in canvas units. */
export function bounds(frames: readonly Frame[]) {
  if (!frames.length) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: Math.min(...frames.map((f) => f.x)),
    top: Math.min(...frames.map((f) => f.y)),
    right: Math.max(...frames.map((f) => f.x + f.width)),
    bottom: Math.max(...frames.map((f) => f.y + f.height)),
  };
}

export const rectOf = (frame: Frame) => bounds([frame]);
