import { describe, expect, test } from "bun:test";
import { createViewport, type Viewport } from "@ui-sdk/core";
import { between, cappedWheelZoom, fitView, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./canvas";
import { bounds, layout, rectOf, SIZES } from "./screens";

type State = { viewport: Viewport };

const SURFACE = { width: 1000, height: 800 };

/** The canvas viewport on a 1000×800 surface, as the canvas primitive sets it up. */
function canvasViewport(start: Viewport = { x: 0, y: 0, zoom: 1 }) {
  let state: State = { viewport: start };
  const store = {
    get: () => state,
    set: (patch: Partial<State>) => void (state = { ...state, ...patch }),
    subscribe: () => () => {},
    setFanout: () => {},
    follow: () => {},
    view: <T>(_next: State, read: () => T) => read(),
  };
  // Bun has no DOM; the viewport only reads the surface's box.
  const surface = { getBoundingClientRect: () => ({ left: 0, top: 0, ...SURFACE }) } as unknown as HTMLElement;
  return createViewport({ store, onDestroy: () => {} }, {
    key: "viewport",
    surface: () => surface,
    minZoom: () => MIN_ZOOM,
    maxZoom: () => MAX_ZOOM,
  });
}

/** Where a screen point sits on the canvas. */
const canvasPoint = ({ x, y, zoom }: Viewport, px: number, py: number) => ({ x: (px - x) / zoom, y: (py - y) / zoom });

const ctrlWheel = (deltaY: number, deltaMode = 0) =>
  ({ deltaY, deltaX: 0, deltaMode, ctrlKey: true, metaKey: false, clientX: 700, clientY: 300, preventDefault() {} }) as unknown as WheelEvent;

describe("zoom toward a point", () => {
  test("keeps the canvas point under the pointer still", () => {
    const viewport = canvasViewport({ x: 120, y: -40, zoom: 0.5 });
    const before = canvasPoint(viewport.get(), 700, 300);
    viewport.zoomBy(1.8, { x: 700, y: 300 });
    const after = viewport.get();
    expect(after.zoom).toBeCloseTo(0.9);
    expect(canvasPoint(after, 700, 300).x).toBeCloseTo(before.x);
    expect(canvasPoint(after, 700, 300).y).toBeCloseTo(before.y);
  });

  test("stops at the zoom limits", () => {
    const viewport = canvasViewport();
    viewport.zoomBy(1000, { x: 10, y: 10 });
    expect(viewport.get().zoom).toBe(MAX_ZOOM);
    viewport.zoomBy(1 / 100000, { x: 10, y: 10 });
    expect(viewport.get().zoom).toBe(MIN_ZOOM);
  });
});

describe("mouse wheel zoom", () => {
  test("one mouse notch zooms one step, in pixels or in lines", () => {
    expect(cappedWheelZoom({ deltaY: -100, deltaMode: 0 })).toBe(ZOOM_STEP);
    expect(cappedWheelZoom({ deltaY: 100, deltaMode: 0 })).toBe(1 / ZOOM_STEP);
    expect(cappedWheelZoom({ deltaY: -3, deltaMode: 1 })).toBe(ZOOM_STEP);
  });

  test("a pinch's small deltas are left to the SDK", () => {
    expect(cappedWheelZoom({ deltaY: -4, deltaMode: 0 })).toBeNull();
    expect(cappedWheelZoom({ deltaY: 12, deltaMode: 0 })).toBeNull();
  });

  // The cap assumes the SDK's rate; if an upgrade changes it, this fails before pinch feels different.
  test("below the cap, the SDK zooms at the rate the cap assumes", () => {
    const viewport = canvasViewport();
    viewport.wheel(ctrlWheel(-20));
    expect(viewport.get().zoom).toBeCloseTo(Math.exp(0.2));
    expect(Math.exp(0.2)).toBeLessThan(ZOOM_STEP);
  });
});

describe("fit", () => {
  const phones = layout([1, 2, 3].map((order) => ({ meta: { name: `${order}`, size: "iphone" as const, order } })));

  test("fit all shows every frame, centred, inside the padding", () => {
    const box = bounds(phones);
    const { x, y, zoom } = fitView(box, SURFACE);
    const left = box.left * zoom + x;
    const right = box.right * zoom + x;
    const top = box.top * zoom + y;
    const bottom = box.bottom * zoom + y;
    expect(left).toBeCloseTo(1000 - right);
    expect(top).toBeCloseTo(800 - bottom);
    expect(Math.min(left, top)).toBeCloseTo(64);
  });

  test("a small screen is shown at 100%, not blown up", () => {
    expect(fitView({ left: 0, top: 0, right: 200, bottom: 100 }, SURFACE)).toEqual({ x: 400, y: 350, zoom: 1 });
  });

  test("zoom to a screen centres that frame", () => {
    const frame = phones[2];
    const { x, y, zoom } = fitView(rectOf(frame), SURFACE);
    expect((frame.x + frame.width / 2) * zoom + x).toBeCloseTo(500);
    expect((frame.y + frame.height / 2) * zoom + y).toBeCloseTo(400);
    expect(zoom).toBeCloseTo((800 - 128) / SIZES.iphone.height);
  });

  test("stepping to a screen keeps a smaller zoom and only pans", () => {
    expect(fitView(rectOf(phones[1]), SURFACE, 0.4).zoom).toBe(0.4);
  });
});

describe("glide", () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = fitView({ left: 2000, top: 0, right: 2402, bottom: 874 }, SURFACE);

  test("starts and ends where asked", () => {
    expect(between(from, to, 0, SURFACE)).toEqual(from);
    const end = between(from, to, 1, SURFACE);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    expect(end.zoom).toBeCloseTo(to.zoom);
  });

  test("halfway, the centre is halfway and the zoom is the geometric mean", () => {
    const mid = between(from, to, 0.5, SURFACE);
    expect(mid.zoom).toBeCloseTo(Math.sqrt(from.zoom * to.zoom));
    expect(canvasPoint(mid, 500, 400).x).toBeCloseTo((canvasPoint(from, 500, 400).x + canvasPoint(to, 500, 400).x) / 2);
  });
});
