"use client";

// Point at it: hold ⌥ over a screen, on the canvas or in Play, to outline the innermost element
// under the pointer; ⌥-click asks for a note, then copies a reference for your agent (reference.ts).
// On the canvas screens are `inert`, so the browser won't hit-test inside them: `elementAt`
// measures boxes instead, the same way in both places.
import { Popover, PopoverContent, PopoverTitle } from "@ui-sdk/react/popover";
import { createToaster, Toast, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";
import { useEffect, useState } from "react";
import { formatReference, type PointedElement, type Reference } from "./reference";
import type { Device } from "./screens";

const toaster = createToaster();

type Pointed = { el: Element; box: DOMRect; reference: Omit<Reference, "note"> & { element: PointedElement } };

const inside = (box: DOMRect, x: number, y: number) => x >= box.left && x < box.right && y >= box.top && y < box.bottom;

/** The screen under a point. In Play the hit is inside its design; on the canvas the design is inert, so the hit is its frame. */
function designAt(x: number, y: number) {
  const hit = document.elementFromPoint(x, y);
  return (
    hit?.closest<HTMLElement>("[data-design]") ??
    hit?.closest("[data-screen]")?.querySelector<HTMLElement>("[data-design]") ??
    null
  );
}

/**
 * Whether `el` can't be seen at this point: it is hidden, it or an ancestor below `root` is faded
 * to nothing, or a scrolling or clipping ancestor cuts it off there.
 */
function unseen(el: Element, root: Element, x: number, y: number) {
  if (getComputedStyle(el).visibility === "hidden") return true;
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const { opacity, overflowX, overflowY } = getComputedStyle(node);
    if (opacity === "0") return true;
    const clips = node !== el && (overflowX !== "visible" || overflowY !== "visible");
    if (clips && !inside(node.getBoundingClientRect(), x, y)) return true;
  }
  return false;
}

/**
 * The innermost element of `root` drawn at a point: the last in document order whose box holds it.
 * That is the deepest one and, z-index aside, the one painted on top. Elements you can't see don't count.
 */
function elementAt(root: Element, x: number, y: number) {
  const all = root.querySelectorAll("*");
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i];
    if (inside(el.getBoundingClientRect(), x, y) && !unseen(el, root, x, y)) return el;
  }
  return null;
}

const linesOf = (el: Element) =>
  (el instanceof HTMLElement ? el.innerText : (el.textContent ?? ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * What the element says: its label, or its lines of text joined by ` · `. Lines of children faded
 * to nothing, like a "pasted!" waiting to show, are left out (`innerText` keeps them).
 */
function textOf(el: Element) {
  const label = el.getAttribute("aria-label");
  if (label) return label;
  const faded = new Set([...el.querySelectorAll("*")].filter((child) => getComputedStyle(child).opacity === "0").flatMap(linesOf));
  return linesOf(el)
    .filter((line) => !faded.has(line))
    .join(" · ");
}

/** The element at a point of the window and its reference, measured in its screen's own pixels. */
function pointAt(page: string, device: Device, x: number, y: number): Pointed | null {
  const design = designAt(x, y);
  const screen = design?.dataset.design;
  if (!design || !screen) return null;
  const root = design.getBoundingClientRect();
  const el = inside(root, x, y) ? elementAt(design, x, y) : null;
  if (!el) return null;
  // On screen over laid-out size: the canvas zoom, or Play's scale when the window is small.
  const scale = root.width / design.offsetWidth;
  const box = el.getBoundingClientRect();
  return {
    el,
    box,
    reference: {
      origin: location.origin,
      page,
      screen,
      ...(device && { device }),
      point: { x: (x - root.left) / scale, y: (y - root.top) / scale },
      element: {
        tag: el.tagName.toLowerCase(),
        text: textOf(el),
        x: (box.left - root.left) / scale,
        y: (box.top - root.top) / scale,
        width: box.width / scale,
        height: box.height / scale,
      },
    },
  };
}

/**
 * The ⌥-hover outline and the ⌥-click note field. Render it where the screens are: beside the
 * canvas, or inside Play's dialog so it sits above Play. Without ⌥ it does nothing.
 * `device` is the Device menu's choice, named in the reference.
 */
export function Pointer({ page, device }: { page: string; device: Device }) {
  const [hover, setHover] = useState<Pointed | null>(null);
  const [picked, setPicked] = useState<Pointed | null>(null);

  useEffect(() => {
    let pointer = { x: -1, y: -1 };
    const show = (alt: boolean) => setHover(alt ? pointAt(page, device, pointer.x, pointer.y) : null);
    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      show(event.altKey);
    };
    const key = (event: KeyboardEvent) => event.key === "Alt" && show(event.type === "keydown");
    const hide = () => setHover(null);
    // Capture, so a ⌥-press neither pans nor selects on the canvas, nor presses a button in Play,
    // nor takes focus from the note field it opens. A ⌥-press while the field is open moves it.
    const press = (event: PointerEvent) => {
      const at = event.altKey && event.button === 0 ? pointAt(page, device, event.clientX, event.clientY) : null;
      if (!at) return;
      event.preventDefault();
      event.stopPropagation();
      setHover(null);
      setPicked(at);
    };
    const swallow = (event: MouseEvent) => {
      if (!event.altKey || !designAt(event.clientX, event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const capture = { capture: true };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("wheel", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("pointerdown", press, capture);
    for (const type of ["mousedown", "click", "dblclick"] as const) window.addEventListener(type, swallow, capture);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("wheel", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("pointerdown", press, capture);
      for (const type of ["mousedown", "click", "dblclick"] as const) window.removeEventListener(type, swallow, capture);
    };
  }, [page, device]);

  return (
    <>
      {hover && !picked && <Outline pointed={hover} />}
      {picked && <NoteField pointed={picked} onClose={() => setPicked(null)} />}
    </>
  );
}

function Outline({ pointed: { box, reference } }: { pointed: Pointed }) {
  const { tag, width, height } = reference.element;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 shadow-[0_0_0_1px_#0d99ff]"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <span className="absolute top-full left-0 mt-1 rounded-sm bg-[#0d99ff] px-1 font-ui text-[10px] leading-4 whitespace-nowrap text-white tabular-nums">
        {tag} · {Math.round(width)}×{Math.round(height)}
      </span>
    </div>
  );
}

/** A note by the element: Enter copies the reference with it, Escape cancels. If the clipboard refuses, the reference shows to select. */
function NoteField({ pointed: { el, reference }, onClose }: { pointed: Pointed; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [unsent, setUnsent] = useState<string | null>(null);
  const { tag, text } = reference.element;
  const copy = () => {
    const line = formatReference({ ...reference, note });
    navigator.clipboard.writeText(line).then(
      () => {
        toaster("Copied a reference for your agent", { description: line });
        onClose();
      },
      () => setUnsent(line),
    );
  };
  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverContent
        anchor={el}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-80 rounded-lg border border-neutral-200 bg-white p-3 font-ui text-xs text-neutral-800 shadow-lg outline-none"
      >
        <PopoverTitle className="truncate text-[11px] font-normal text-neutral-500">
          {reference.screen} · {tag}
          {text && ` “${text}”`}
        </PopoverTitle>
        {unsent === null ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              copy();
            }}
          >
            {/* The popover moves focus only when a trigger opens it, and this one mounts open. */}
            <input
              autoFocus
              aria-label="Note for your agent"
              placeholder="Add a note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 h-8 w-full rounded-md border border-neutral-200 px-2 text-[13px] outline-none focus:border-[#0d99ff]"
            />
            <p className="mt-1.5 text-[11px] text-neutral-400">Enter copies a reference · Esc cancels</p>
          </form>
        ) : (
          <>
            <p className="mt-2 text-neutral-600">Couldn’t copy. Select the reference and copy it:</p>
            <textarea
              readOnly
              rows={5}
              value={unsent}
              ref={(area) => area?.select()}
              aria-label="Reference"
              className="mt-1.5 w-full resize-none rounded-md border border-neutral-200 p-2 font-mono text-[11px] outline-none focus:border-[#0d99ff]"
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Where the copy toast shows: bottom centre, in the top layer, so above Play too. */
export function PointerToasts() {
  return (
    <ToastRegion
      toaster={toaster}
      maxVisible={1}
      shortcut={null} // Nothing in it to focus, so no F6 in the shortcut list.
      className="fixed inset-auto bottom-6 left-1/2 m-0 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-visible border-0 bg-transparent p-0 font-ui"
    >
      {() => (
        <Toast className="rounded-lg bg-neutral-900 px-3 py-2 text-white shadow-lg transition-[opacity,translate] duration-200 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0">
          <ToastTitle className="text-xs font-medium" />
          <ToastDescription className="mt-0.5 line-clamp-2 text-[11px] break-all text-neutral-400" />
        </Toast>
      )}
    </ToastRegion>
  );
}
