"use client";

import { usePart, usePrimitive, type PrimitiveHandle } from "@ui-sdk/react/primitive";
import { shortcuts, useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@ui-sdk/react/tooltip";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, use, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { canvas, ZOOM_STEP } from "./canvas";
import { loadPages, type Page } from "./designs";
import { GoContext } from "./go";
import { Pointer, PointerToasts } from "./point";
import { parsePin, type Point } from "./reference";
import {
  bounds,
  cornerOf,
  DEVICE_NAMES,
  DEVICES,
  isPreset,
  layout,
  rectOf,
  sizeAs,
  sizeOf,
  SIZES,
  type Device,
  type Frame,
  type Screen,
} from "./screens";

const pages = loadPages();

type Canvas = PrimitiveHandle<typeof canvas>;

const screenCount = (n: number) => `${n} ${n === 1 ? "screen" : "screens"}`;

/**
 * The URL is the view: `/<page>?screen=<id>` selects a screen, `&play=1` presents it,
 * `&device=desktop` shows every screen as that device, and `&pin=x,y` marks a point on the
 * selected screen. Every write clears the pin.
 */
function useView() {
  const search = useSearchParams();
  const device = search.get("device");
  return {
    screen: search.get("screen"),
    play: search.has("play"),
    device: isPreset(device) ? device : null,
    pin: search.get("pin"),
    write: writeView,
  };
}

function writeView(next: { screen?: string; play?: boolean; device?: Device }) {
  const params = new URLSearchParams(window.location.search);
  params.delete("pin");
  if (next.screen !== undefined) params.set("screen", next.screen);
  if (next.device) params.set("device", next.device);
  else if (next.device === null) params.delete("device");
  if (next.play) params.set("play", "1");
  else if (next.play === false) params.delete("play");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

/** The whole app for one page: sidebar, top bar, canvas and Play. Renders in the browser only, since it measures the window. */
export function Lienzo({ params }: { params: Promise<{ page: string }> }) {
  use(browser("The canvas measures the window, so it renders in the browser."));
  const { page: pageId } = use(params);
  const page = pages.find((p) => p.id === pageId);
  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-100 font-ui text-neutral-800">
      {page ? (
        <PageView key={page.id} page={page} />
      ) : pages.length ? (
        <>
          <Sidebar current={undefined} device={null} selected={null} onSelect={() => {}} />
          <UnknownPage id={pageId} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function PageView({ page }: { page: Page }) {
  const view = useView();
  const router = useRouter();
  const handle = usePrimitive(canvas, {});
  const device = view.device;
  const frames = useMemo(() => layout(page.screens, device), [page, device]);
  const all = bounds(frames);
  const rects = useMemo(() => frames.map(rectOf), [frames]);
  const selected = page.screens.find((s) => s.id === view.screen) ?? null;
  const playing = view.play && page.screens.length > 0;
  const shown = selected ?? page.screens[0];
  const pin = useMemo(() => (selected ? parsePin(view.pin) : null), [selected, view.pin]);
  const [chrome, setChrome] = useState(true);
  const [help, setHelp] = useState<HelpRow[] | null>(null);

  const frameOf = (id: string) => frames[page.screens.findIndex((s) => s.id === id)];
  const fitAll = () => handle.api.glide(handle.api.fitted(all));
  const zoomToScreen = (id: string) => {
    const frame = frameOf(id);
    if (frame) handle.api.glide(handle.api.fitted(rectOf(frame)));
  };
  const zoomToSelection = () => selected && zoomToScreen(selected.id);
  const zoomBy = (factor: number) => {
    handle.api.stop();
    handle.api.viewport.zoomBy(factor);
  };
  const zoomTo100 = () => {
    handle.api.stop();
    handle.api.viewport.zoomTo(1);
  };
  // Shows every screen as `next`, then fits the selected screen (or all of them) at their new sizes.
  const chooseDevice = (next: Device) => {
    view.write({ device: next });
    const nextFrames = layout(page.screens, next);
    const frame = selected && nextFrames[page.screens.indexOf(selected)];
    handle.api.glide(handle.api.fitted(frame ? rectOf(frame) : bounds(nextFrames)));
  };
  const cycleDevice = () => chooseDevice(DEVICES[(DEVICES.indexOf(device) + 1) % DEVICES.length]);

  // Open on the selected screen, or the whole page, without a glide. Runs again for a new page (PageView is keyed by page).
  useLayoutEffect(() => {
    const frame = selected && frameOf(selected.id);
    handle.api.viewport.setViewport(handle.api.fitted(frame ? rectOf(frame) : all));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the page first shows
  }, []);

  const select = (id: string) => view.write({ screen: id });
  // Reads the screen from the URL, not from this render: the dialog can call an older copy of
  // this function, and Play may have moved to another screen since.
  const play = (open: boolean) => {
    const current = new URLSearchParams(window.location.search).get("screen") ?? shown?.id;
    if (open) view.write({ screen: current, play: true });
    else {
      view.write({ play: false });
      if (current) zoomToScreen(current);
    }
  };
  // Selects the screen before or after the selected one and pans to it, zooming out only if it would not fit.
  const step = (by: 1 | -1) => {
    const next = selected && page.screens[page.screens.indexOf(selected) + by];
    if (!next) return;
    select(next.id);
    handle.api.glide(handle.api.fitted(rectOf(frameOf(next.id)), handle.api.viewport.get().zoom));
  };
  const go = (to: string) => {
    const [pageId, screenId] = to.split("/");
    if (pageId === page.id && page.screens.some((s) => s.id === screenId)) view.write({ screen: screenId });
    else if (pages.some((p) => p.id === pageId && p.screens.some((s) => s.id === screenId))) {
      router.push(`/${pageId}?screen=${screenId}&play=1`);
    } else console.warn(`Lienzo: <Go to="${to}"> points at a screen that does not exist.`);
  };
  // The registry names the help key `⇧?`, but people press it as `?`.
  const openHelp = () =>
    setHelp(byAction([...shortcuts.list().map((s) => (s.keys === "shift+?" ? { ...s, hint: "?" } : s)), ...VIEW_KEYS]));

  // Registered in the order the help dialog lists them.
  useShortcut("shift+1", fitAll, { description: "Zoom to fit all screens" });
  useShortcut("shift+2", zoomToSelection, { description: "Zoom to the selected screen" });
  useShortcut("shift+0", zoomTo100, { description: "Zoom to 100%" });
  useShortcut("arrowleft", () => step(-1), { description: "Select the previous screen" });
  useShortcut("arrowright", () => step(1), { description: "Select the next screen" });
  // The registry takes Enter even on a focused button or link, so press that instead. A `when`
  // guard would also work, but it would drop Enter from the help list while a button has focus.
  useShortcut(
    "enter",
    (event) => {
      const control = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a[href]") : null;
      if (control) control.click();
      else if (selected) play(true);
    },
    { description: "Play the selected screen" },
  );
  useShortcut("p", () => play(true), { description: "Play" });
  useShortcut("d", cycleDevice, { description: "Switch device" });
  useShortcut("mod+\\", () => setChrome((on) => !on), { description: "Hide or show the sidebar and top bar" });
  useShortcut("shift+?", openHelp, { description: "Show keyboard shortcuts" });
  useShortcut(pin ? "escape" : null, () => writeView({}), { description: "Clear the pin" });
  // A press anywhere clears the pin too.
  useEffect(() => {
    if (!pin) return;
    const clear = () => writeView({});
    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, [pin]);
  const panning = useSpaceAndZoomKeys(handle, !playing && !help);

  // A press that doesn't move selects the frame under it; a double press plays it.
  const frameAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-screen]")?.dataset.screen;
  const onPointerDown = (down: React.PointerEvent) => {
    const up = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > 4) return;
      const id = frameAt(event.clientX, event.clientY);
      if (id) select(id);
    };
    window.addEventListener("pointerup", up, { once: true });
  };
  const onDoubleClick = (event: React.MouseEvent) => {
    const id = frameAt(event.clientX, event.clientY);
    if (id) view.write({ screen: id, play: true });
  };

  return (
    <>
      {chrome && (
        <Sidebar
          current={page}
          device={device}
          selected={selected?.id ?? null}
          onSelect={(id) => {
            select(id);
            zoomToScreen(id);
          }}
        />
      )}
      <Dialog open={playing} onOpenChange={(open) => play(open)} closeOnOutsidePress={false}>
        <div className="flex min-w-0 flex-1 flex-col">
          {chrome && (
            <header className="flex h-11 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white pr-2 pl-4">
              <p className="flex min-w-0 items-baseline gap-2 text-[13px]">
                <span className="truncate font-medium">{page.name}</span>
                <span className="shrink-0 text-xs text-neutral-400 tabular-nums">{screenCount(page.screens.length)}</span>
                {selected && (
                  <>
                    <span aria-hidden="true" className="text-neutral-300">
                      /
                    </span>
                    <span className="truncate">{selected.meta.name}</span>
                  </>
                )}
              </p>
              <Toolbar aria-label="View" className="ml-auto flex items-center gap-0.5">
                <DeviceMenu device={device} onChoose={chooseDevice} />
                <ToolbarSeparator className="mx-1.5 h-4 w-px bg-neutral-200" />
                <IconButton label="Zoom out" keys="−" ariaKeys="-" onClick={() => zoomBy(1 / ZOOM_STEP)}>
                  <path d="M3 8h10" />
                </IconButton>
                <ZoomMenu handle={handle} selected={!!selected} actions={{ fitAll, zoomToSelection, zoomTo100, zoomBy }} />
                <IconButton label="Zoom in" keys="+" ariaKeys="=" onClick={() => zoomBy(ZOOM_STEP)}>
                  <path d="M3 8h10M8 3v10" />
                </IconButton>
                <ToolbarSeparator className="mx-1.5 h-4 w-px bg-neutral-200" />
                <IconButton label="Keyboard shortcuts" keys="?" ariaKeys="Shift+?" onClick={openHelp}>
                  <path d="M6 6a2 2 0 1 1 2.8 1.8C8.3 8 8 8.4 8 9v.5M8 12v.01" />
                </IconButton>
                <Tooltip shortcut="p">
                  <TooltipTrigger
                    render={<ToolbarButton render={<DialogTrigger />} />}
                    className="ml-1 h-7 rounded-md bg-[#0d99ff] px-3 text-xs font-medium text-white outline-offset-2 hover:bg-[#0b87e0] focus-visible:outline-2 focus-visible:outline-[#0d99ff]"
                  >
                    Play
                  </TooltipTrigger>
                  <TooltipContent className={TIP}>
                    Play this screen <TooltipShortcut className={TIP_KEYS} />
                  </TooltipContent>
                </Tooltip>
              </Toolbar>
            </header>
          )}
          <main className="relative min-h-0 flex-1">
            <CanvasSurface handle={handle} panning={panning} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
              {page.screens.map((screen, i) => (
                <FrameView
                  key={screen.id}
                  screen={screen}
                  frame={frames[i]}
                  corner={cornerOf(sizeAs(screen.meta, device))}
                  selected={screen.id === selected?.id}
                  pin={screen.id === selected?.id ? pin : null}
                />
              ))}
            </CanvasSurface>
            <BackToScreens handle={handle} rects={rects} onClick={fitAll} />
            {!playing && <Pointer page={page.id} device={device} />}
          </main>
        </div>
        <DialogBackdrop className="fixed inset-0 bg-neutral-950" />
        {/* Focus starts on the stage, so no button of the screen shows a focus ring. */}
        <DialogContent
          initialFocus="content"
          className="fixed inset-0 m-0 flex size-full max-h-none max-w-none flex-col items-center justify-center gap-3 bg-transparent p-0 outline-none">
          {shown && (
            <>
              <DialogTitle className="text-xs font-normal text-neutral-400">
                {shown.meta.name} <span className="text-neutral-600">· Esc to exit</span>
              </DialogTitle>
              <GoContext value={go}>
                <PlayStage
                  key={shown.id}
                  screen={shown}
                  frame={frameOf(shown.id)}
                  corner={cornerOf(sizeAs(shown.meta, device))}
                />
              </GoContext>
              <Pointer page={page.id} device={device} />
            </>
          )}
        </DialogContent>
      </Dialog>
      <HelpDialog rows={help} onClose={() => setHelp(null)} />
      <PointerToasts />
    </>
  );
}

/** Space shows the hand while held; `+`, `-` and `0` zoom. Both skip text fields and keys a shortcut already took. */
function useSpaceAndZoomKeys(handle: Canvas, active: boolean) {
  const [space, setSpace] = useState(false);
  useEffect(() => {
    if (!active) return;
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      // Space on a focused button or link still presses it.
      if (event.key === " " && !(event.target instanceof Element && event.target.closest("button, a"))) {
        event.preventDefault();
        setSpace(true);
      } else if (handle.api.viewport.keydown(event)) handle.api.stop();
    };
    const up = (event: KeyboardEvent) => event.key === " " && setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      setSpace(false);
    };
  }, [handle, active]);
  return space;
}

function CanvasSurface({
  handle,
  panning,
  children,
  ...props
}: {
  handle: Canvas;
  panning: boolean;
  children: ReactNode;
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick: (event: React.MouseEvent) => void;
}) {
  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      "aria-label": "Canvas",
      className: `size-full ${panning ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`,
      children: (
        <>
          <Grid />
          <World>{children}</World>
        </>
      ),
    },
    "div",
  );
}

function Grid() {
  return usePart(canvas, "grid", {}, { "aria-hidden": true, className: "pointer-events-none absolute inset-0" }, "div");
}

function World({ children }: { children: ReactNode }) {
  return usePart(canvas, "world", {}, { className: "absolute top-0 left-0 data-moving:will-change-transform", children }, "div");
}

/** Shown while every screen is off screen; brings them all back. */
function BackToScreens({ handle, rects, onClick }: { handle: Canvas; rects: ReturnType<typeof rectOf>[]; onClick: () => void }) {
  const hint = useShortcutHint("shift+1");
  return usePart(
    handle,
    "recenter",
    { rects },
    {
      type: "button",
      onClick,
      "aria-keyshortcuts": hint.ariaKeyshortcuts,
      className:
        "absolute bottom-5 left-1/2 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-xs font-medium shadow-md hover:bg-neutral-50",
      children: (
        <>
          Back to screens
          <kbd aria-hidden="true" className="font-ui text-neutral-400">
            {hint.text}
          </kbd>
        </>
      ),
    },
    "button",
  );
}

const TIP = "rounded-md bg-neutral-900 px-2 py-1 text-[11px] text-white shadow-md";
const TIP_KEYS = "ml-1.5 text-neutral-400";
const TOOL =
  "flex h-7 min-w-7 items-center justify-center rounded-md text-neutral-600 outline-offset-1 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#0d99ff] data-open:bg-neutral-100";

/** A square toolbar button with a 16 px stroked icon, named by its tooltip, which also shows its keys (`ariaKeys` for screen readers). */
function IconButton({
  label,
  keys,
  ariaKeys,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  ariaKeys: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<ToolbarButton />}
        aria-label={label}
        aria-keyshortcuts={ariaKeys}
        onClick={onClick}
        className={TOOL}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round]">
          {children}
        </svg>
      </TooltipTrigger>
      <TooltipContent className={TIP}>
        {label} <kbd className={TIP_KEYS}>{keys}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function ZoomMenu({
  handle,
  selected,
  actions,
}: {
  handle: Canvas;
  selected: boolean;
  actions: { fitAll: () => void; zoomToSelection: () => void; zoomTo100: () => void; zoomBy: (factor: number) => void };
}) {
  const item =
    "flex h-7 cursor-default items-center gap-8 rounded px-2 outline-none data-disabled:text-neutral-300 data-highlighted:bg-[#0d99ff] data-highlighted:text-white";
  const keys = "ml-auto text-neutral-400 [[data-highlighted]_&]:text-white/80 [[data-disabled]_&]:text-neutral-300";
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger render={<ToolbarButton render={<MenuTrigger />} />} className={`${TOOL} gap-1 px-1.5 text-xs`}>
          <ZoomLevel handle={handle} />
          <svg viewBox="0 0 8 8" aria-hidden="true" className="size-2 fill-none stroke-current stroke-[1.5]">
            <path d="M1.5 3 4 5.5 6.5 3" />
          </svg>
        </TooltipTrigger>
        <TooltipContent className={TIP}>Zoom</TooltipContent>
      </Tooltip>
      <MenuContent align="end" className="min-w-52 rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-lg outline-none">
        <MenuItem className={item} onSelect={() => actions.zoomBy(ZOOM_STEP)}>
          Zoom in <kbd className={keys}>+</kbd>
        </MenuItem>
        <MenuItem className={item} onSelect={() => actions.zoomBy(1 / ZOOM_STEP)}>
          Zoom out <kbd className={keys}>−</kbd>
        </MenuItem>
        <MenuSeparator className="my-1 h-px bg-neutral-200" />
        <MenuItem className={item} shortcut="shift+1" onSelect={actions.fitAll}>
          Zoom to fit <MenuShortcut className={keys} />
        </MenuItem>
        <MenuItem className={item} shortcut="shift+2" disabled={!selected} onSelect={actions.zoomToSelection}>
          Zoom to selection <MenuShortcut className={keys} />
        </MenuItem>
        <MenuItem className={item} shortcut="shift+0" onSelect={actions.zoomTo100}>
          100% <MenuShortcut className={keys} />
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const DEVICE_ITEM =
  "flex h-7 cursor-default items-center gap-2 rounded px-2 outline-none data-highlighted:bg-[#0d99ff] data-highlighted:text-white";
const DEVICE_SIZE = "ml-auto pl-6 text-neutral-400 tabular-nums [[data-highlighted]_&]:text-white/80";
/** As designed leaves `?device=` out of the URL, so the menu names it with a value of its own. */
const AS_DESIGNED = "as-designed";

/** Shows every screen as a phone or desktop, or at each file's own size. `D` cycles the same choices. */
function DeviceMenu({ device, onChoose }: { device: Device; onChoose: (device: Device) => void }) {
  return (
    <Menu>
      <Tooltip shortcut="d">
        <TooltipTrigger render={<ToolbarButton render={<MenuTrigger />} />} className={`${TOOL} gap-1 px-1.5 text-xs`}>
          {device ? DEVICE_NAMES[device] : "As designed"}
          <svg viewBox="0 0 8 8" aria-hidden="true" className="size-2 fill-none stroke-current stroke-[1.5]">
            <path d="M1.5 3 4 5.5 6.5 3" />
          </svg>
        </TooltipTrigger>
        <TooltipContent className={TIP}>
          Device <TooltipShortcut className={TIP_KEYS} />
        </TooltipContent>
      </Tooltip>
      <MenuContent align="end" className="min-w-52 rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-lg outline-none">
        <MenuRadioGroup
          value={device ?? AS_DESIGNED}
          onValueChange={(value) => onChoose(isPreset(value) ? value : null)}
        >
          {DEVICES.map((choice) => (
            <MenuRadioItem key={choice ?? AS_DESIGNED} value={choice ?? AS_DESIGNED} closeOnSelect className={DEVICE_ITEM}>
              <span className="w-3">
                <MenuItemIndicator>
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 fill-none stroke-current stroke-[1.5]">
                    <path d="m2.5 6.5 2.5 2.5 4.5-6" />
                  </svg>
                </MenuItemIndicator>
              </span>
              {choice ? DEVICE_NAMES[choice] : "As designed"}
              {choice && (
                <span className={DEVICE_SIZE}>
                  {SIZES[choice].width}×{SIZES[choice].height}
                </span>
              )}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function ZoomLevel({ handle }: { handle: Canvas }) {
  return usePart(
    handle,
    "zoom",
    {},
    {
      className: "w-9 text-right tabular-nums",
      children: ({ zoom }) => `${Math.round(zoom * 100)}%`,
    },
    "span",
  );
}

type HelpRow = { hint: string; description?: string };

// The SDK viewport handles these itself (the shortcut registry can't name `+`), so the help lists them by hand.
const VIEW_KEYS: HelpRow[] = [
  { hint: "+", description: "Zoom in" },
  { hint: "−", description: "Zoom out" },
  { hint: "0", description: "Zoom to 100%" },
];

/** One row per action: keys that do the same thing share a row, like `⇧0 / 0` for 100%. */
function byAction(rows: HelpRow[]): HelpRow[] {
  const hints = new Map<string | undefined, string[]>();
  for (const { hint, description } of rows) hints.set(description, [...(hints.get(description) ?? []), hint]);
  return [...hints].map(([description, keys]) => ({ description, hint: keys.join(" / ") }));
}

const GESTURES: HelpRow[] = [
  { hint: "Drag, scroll", description: "Pan" },
  { hint: "Pinch, ⌘/Ctrl + scroll", description: "Zoom at the pointer" },
  { hint: "Click a screen or its name", description: "Select it" },
  { hint: "Double-click a screen", description: "Play it" },
  { hint: "Hold Space", description: "Show the hand" },
  { hint: "Hold ⌥", description: "Outline the element under the pointer" },
  { hint: "⌥-click", description: "Copy a reference to it for your agent" },
];

/** Every shortcut that can run, read from the registry when the dialog opens, then the pointer gestures. */
function HelpDialog({ rows, onClose }: { rows: HelpRow[] | null; onClose: () => void }) {
  const section = (title: string, list: HelpRow[]) => (
    <section className="mt-4">
      <h3 className="pb-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">{title}</h3>
      <dl className="divide-y divide-neutral-100">
        {list.map(({ hint, description }) => (
          <div key={hint} className="flex h-8 items-center justify-between gap-4">
            <dt className="text-neutral-700">{description}</dt>
            <dd>
              <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-ui text-[11px] text-neutral-600 tabular-nums">
                {hint}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
  return (
    <Dialog open={rows !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogBackdrop className="fixed inset-0 bg-neutral-950/30" />
      <DialogContent className="fixed top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[26rem] -translate-1/2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 font-ui text-xs text-neutral-800 shadow-xl outline-none">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-[13px] font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogClose aria-label="Close" className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round]">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </DialogClose>
        </div>
        {rows && section("Keys", rows)}
        {section("Pointer", GESTURES)}
      </DialogContent>
    </Dialog>
  );
}

/**
 * One screen at its real size on the canvas, with its name (and size, on hover or selection) above it,
 * and a marker at `pin`, a point in the screen's pixels. `corner` rounds a phone's frame. Not interactive.
 */
const FrameView = memo(function FrameView({
  screen,
  frame,
  corner: borderRadius,
  selected,
  pin,
}: {
  screen: Screen;
  frame: Frame;
  corner: number;
  selected: boolean;
  pin: Point | null;
}) {
  const { Component } = screen;
  const onHover = selected ? "" : "invisible group-hover:visible";
  return (
    <div
      data-screen={screen.id}
      className="group absolute"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div
        className="absolute bottom-full left-0 flex w-full items-baseline gap-[0.6em] whitespace-nowrap"
        style={{ fontSize: "calc(11px / var(--canvas-zoom))", paddingBottom: "calc(5px / var(--canvas-zoom))" }}
      >
        <span className={`min-w-0 truncate ${selected ? "text-[#0d99ff]" : "text-neutral-500"}`}>{screen.meta.name}</span>
        <span className={`ml-auto shrink-0 text-neutral-400 tabular-nums ${onHover}`}>
          {frame.width}×{frame.height}
        </span>
      </div>
      {/* Resetting --canvas-zoom here keeps each zoom step from restyling the screen's whole tree. */}
      <div
        inert
        data-design={screen.id}
        className="@container pointer-events-none size-full overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] [--canvas-zoom:1]"
        style={{ borderRadius }}
      >
        <Component />
      </div>
      {/* A ring, not an outline: browsers round outline widths to whole pixels, which breaks 1px ÷ zoom. */}
      <div
        className={`pointer-events-none absolute inset-0 ${onHover}`}
        style={{ borderRadius, boxShadow: `0 0 0 calc(${selected ? 2 : 1}px / var(--canvas-zoom)) #0d99ff` }}
      />
      {pin && (
        <div
          role="img"
          aria-label={`Pin at ${pin.x}, ${pin.y}`}
          className="pointer-events-none absolute *:absolute *:size-[calc(14px/var(--canvas-zoom))] *:-translate-1/2 *:rounded-full *:bg-[#0d99ff]"
          style={{ left: pin.x, top: pin.y }}
        >
          <span className="opacity-60 motion-safe:animate-ping" />
          <span className="shadow-[0_0_0_calc(2px/var(--canvas-zoom))_white,0_1px_4px_rgba(0,0,0,0.4)]" />
        </div>
      )}
    </div>
  );
});

/** The screen alone at its real size, scaled down only when the window is smaller. Fully interactive. */
function PlayStage({ screen, frame, corner }: { screen: Screen; frame: Frame | undefined; corner: number }) {
  const [scale, setScale] = useState(1);
  const width = frame?.width ?? 0;
  const height = frame?.height ?? 0;
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 48) / width, (window.innerHeight - 80) / height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, height]);
  const { Component } = screen;
  return (
    <div style={{ width: width * scale, height: height * scale }}>
      <div
        data-design={screen.id}
        className="@container overflow-hidden bg-white"
        style={{ width, height, borderRadius: corner, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <Component />
      </div>
    </div>
  );
}

function Sidebar({
  current,
  device,
  selected,
  onSelect,
}: {
  current: Page | undefined;
  device: Device;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const row = "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left";
  const heading = "px-2 pt-3 pb-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase";
  const muted = "ml-auto shrink-0 text-[11px] text-neutral-400 tabular-nums";
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white text-xs">
      <div className="flex h-11 shrink-0 items-center border-b border-neutral-200 px-4 text-[13px] font-semibold">Lienzo</div>
      <nav aria-label="Pages" className="px-2 pb-2">
        <h2 className={heading}>Pages</h2>
        <ul>
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${p.id}`}
                aria-current={p.id === current?.id ? "page" : undefined}
                aria-label={`${p.name}, ${screenCount(p.screens.length)}`}
                className={`${row} hover:bg-neutral-100 aria-[current=page]:bg-neutral-100 aria-[current=page]:font-medium`}
              >
                <span className="min-w-0 truncate">{p.name}</span>
                <span className={muted}>{p.screens.length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {current && (
        <nav aria-label="Screens" className="border-t border-neutral-200 px-2 pb-2">
          <h2 className={heading}>Screens</h2>
          <ul>
            {current.screens.map((s) => {
              const size = sizeOf(sizeAs(s.meta, device));
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-current={s.id === selected ? "true" : undefined}
                    className={`${row} hover:bg-neutral-100 aria-[current=true]:bg-[#e5f4ff] aria-[current=true]:text-[#0b6fbf]`}
                  >
                    <span className="min-w-0 truncate">{s.meta.name}</span>
                    <span className={muted}>
                      {size.width}×{size.height}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </aside>
  );
}

/** A URL naming a page that doesn't exist: say so and link the ones that do. */
function UnknownPage({ id }: { id: string }) {
  return (
    <div className="m-auto max-w-sm text-center text-[13px]">
      <p className="font-medium">No page called “{id}”.</p>
      <p className="mt-1 text-xs text-neutral-500">Open one of these:</p>
      <ul className="mt-3 flex flex-col gap-1 text-xs">
        {pages.map((p) => (
          <li key={p.id}>
            <Link href={`/${p.id}`} className="text-[#0b6fbf] hover:underline">
              {p.name}
            </Link>{" "}
            <span className="text-neutral-400 tabular-nums">· {screenCount(p.screens.length)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NEW_SCREEN = "bun run lienzo new <page> <screen> --size iphone";

/** No pages at all: how to start one. If the clipboard refuses, the command stays selectable. */
function EmptyState() {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  useEffect(() => {
    if (copied !== "yes") return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="m-auto w-[30rem] rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-[15px] font-semibold">No designs yet</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Start a page with its first screen, then describe the screen to an agent. It shows up here as soon as the file
        exists.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap select-all">{NEW_SCREEN}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(NEW_SCREEN).then(() => setCopied("yes"), () => setCopied("failed"))}
          className="h-7 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium hover:bg-neutral-50"
        >
          {copied === "yes" ? "Copied" : "Copy"}
        </button>
      </div>
      {copied === "failed" && <p className="mt-2 text-xs text-neutral-500">Couldn’t copy. Select the command and copy it.</p>}
    </div>
  );
}
