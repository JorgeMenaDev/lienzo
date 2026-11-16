// The canvas behaviour: UI SDK's viewport on a surface that clips a world of frames.
// Dragging anywhere pans (screens are not interactive on the canvas), the wheel or a
// two-finger scroll pans, and pinch or Ctrl/⌘ + wheel zooms toward the pointer.
import { createViewport, css, definePrimitive, live, type CanvasRect, type Viewport } from "@ui-sdk/core";

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
/** One zoom step: the zoom buttons, `+` and `-`, and the most one mouse wheel notch zooms. */
export const ZOOM_STEP = 1.25;
const FIT_PADDING = 64;
const GLIDE_MS = 200;
const GRID = 16;

type Size = { width: number; height: number };

/**
 * The viewport that shows a box of the canvas whole and centred on a surface of `size`,
 * zoomed in no further than `maxZoom`. Fit-all and zoom-to-screen use 100%; stepping
 * between screens uses the current zoom, so it pans unless the screen would not fit.
 */
export function fitView(rect: CanvasRect, size: Size, maxZoom = 1): Viewport {
  const width = Math.max(rect.right - rect.left, 1);
  const height = Math.max(rect.bottom - rect.top, 1);
  const fits = Math.min((size.width - 2 * FIT_PADDING) / width, (size.height - 2 * FIT_PADDING) / height);
  const zoom = Math.min(Math.max(Math.min(fits, maxZoom), MIN_ZOOM), MAX_ZOOM);
  return {
    x: size.width / 2 - ((rect.left + rect.right) / 2) * zoom,
    y: size.height / 2 - ((rect.top + rect.bottom) / 2) * zoom,
    zoom,
  };
}

/**
 * The camera `t` of the way (0 to 1) from one viewport to another: the point at the
 * surface's centre moves in a straight line and the zoom changes at an even rate, so
 * a glide reads as one move rather than a swing.
 */
export function between(from: Viewport, to: Viewport, t: number, size: Size): Viewport {
  const centre = (v: Viewport) => ({ x: (size.width / 2 - v.x) / v.zoom, y: (size.height / 2 - v.y) / v.zoom });
  const a = centre(from);
  const b = centre(to);
  const zoom = from.zoom * (to.zoom / from.zoom) ** t;
  return {
    x: size.width / 2 - (a.x + (b.x - a.x) * t) * zoom,
    y: size.height / 2 - (a.y + (b.y - a.y) * t) * zoom,
    zoom,
  };
}

// UI SDK zooms by e^(-0.01 × deltaY) per Ctrl/⌘ + wheel event, a line counting as 16 px.
// A pinch sends many small deltas; a mouse notch sends one of 100 or more (×1.65 in the SDK).
const WHEEL_RATE = 0.01;
const LINE = 16;
const PAGE = 800;

/**
 * The zoom factor for a Ctrl/⌘ + wheel event that would zoom more than one `ZOOM_STEP`,
 * capped to it: a mouse notch. `null` for smaller ones, like a pinch, which the SDK zooms as is.
 */
export function cappedWheelZoom(event: Pick<WheelEvent, "deltaY" | "deltaMode">): number | null {
  const pixels = event.deltaY * (event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? PAGE : 1);
  const factor = Math.exp(-pixels * WHEEL_RATE);
  if (factor > ZOOM_STEP) return ZOOM_STEP;
  if (factor < 1 / ZOOM_STEP) return 1 / ZOOM_STEP;
  return null;
}

const overlaps = (a: CanvasRect, b: CanvasRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** A dot every 16 canvas pixels, 1 px on screen at any zoom, fading out between 50% and 25%. */
function gridStyle({ x, y, zoom }: Viewport) {
  const size = GRID * zoom;
  return css({
    "background-image": "radial-gradient(circle, #c9c9c9 1px, transparent 1.25px)",
    "background-size": `${size}px ${size}px`,
    "background-position": `${x - size / 2}px ${y - size / 2}px`,
    opacity: String(Math.min(1, Math.max(0, (zoom - 0.25) / 0.25))),
  });
}

export const canvas = definePrimitive({
  name: "canvas",
  state: () => ({ viewport: { x: 0, y: 0, zoom: 1 } as Viewport }),
  live: ["viewport"],
  api: (context) => {
    const surface = () => context.element("root");
    const viewport = createViewport(context, {
      key: "viewport",
      surface,
      minZoom: () => MIN_ZOOM,
      maxZoom: () => MAX_ZOOM,
    });
    const size = (): Size => surface()?.getBoundingClientRect() ?? { width: 0, height: 0 };
    let frame = 0;
    const stop = () => cancelAnimationFrame(frame);
    context.onDestroy(stop);
    return {
      viewport,
      /** Stops a glide; a gesture or zoom key calls it so the person's move wins. */
      stop,
      /** The viewport that shows `rect` on this surface; see `fitView`. */
      fitted: (rect: CanvasRect, maxZoom = 1) => fitView(rect, size(), maxZoom),
      /** Moves the camera to `to` over 200 ms, easing out, or at once when the person asks for less motion. */
      glide: (to: Viewport) => {
        stop();
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return void viewport.setViewport(to);
        const from = viewport.get();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / GLIDE_MS);
          viewport.setViewport(between(from, to, 1 - (1 - t) ** 3, size()));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({
        style: css({ position: "relative", overflow: "clip", "touch-action": "none" }),
      }),
      on: {
        wheel: (event, { api }) => {
          api.stop();
          const wheel = event as WheelEvent;
          const capped = wheel.ctrlKey || wheel.metaKey ? cappedWheelZoom(wheel) : null;
          if (capped === null) return api.viewport.wheel(wheel);
          wheel.preventDefault();
          api.viewport.zoomBy(capped, { x: wheel.clientX, y: wheel.clientY }, { reason: "wheel", event: wheel });
        },
        pointerdown: (event, { api }) => {
          if (event.target instanceof Element && event.target.closest("button, a")) return;
          api.stop();
          api.viewport.pointerdown(event as PointerEvent);
        },
      },
    }),
    grid: slot({
      live: live((state) => ({ style: gridStyle(state.viewport) })),
    }),
    world: slot({
      live: live((state, { api }) => ({ style: api.viewport.style(state) })),
      // `data-moving` is set while the view moves and for 150 ms after, so the world can be
      // one GPU layer during a gesture (smooth) and re-rasterize sharp when it stops.
      bind: (el, part) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = part.store.subscribe(() => {
          el.dataset.moving = "";
          clearTimeout(timer);
          timer = setTimeout(() => delete el.dataset.moving, 150);
        });
        return () => {
          unsubscribe();
          clearTimeout(timer);
        };
      },
    }),
    zoom: slot<object, { zoom: number }>({
      state: (state) => ({ zoom: state.viewport.zoom }),
    }),
    /** "Back to screens": present only while every frame in `rects` is off screen. */
    recenter: slot<{ rects: CanvasRect[] }>({
      props: { rects: "value" },
      present: (_state, { props, api }) => {
        const view = api.viewport.visible();
        return !props.rects.some((rect) => overlaps(view, rect));
      },
    }),
  }),
});
