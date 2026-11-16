# Designs

Read this before you design. Every design in Lienzo is a file here; the app only shows them.

## Pages and screens

- A **page** is a folder: `designs/<page>/`, like `designs/example/`. It is one canvas, like a Figma page.
- A **screen** is one `.tsx` file in it: `designs/<page>/<screen>.tsx`. Its URL is `/<page>?screen=<screen>`.
- Page and screen ids are lowercase words joined by `-`: `onboarding`, `sign-in`.
- Files that start with `_` are helpers, not screens: shared components (`_kit.tsx`), and the page's name in `_page.ts`:

  ```ts
  import type { PageMeta } from "@/lienzo/screens";

  export const page = { name: "Example – Trailhead" } satisfies PageMeta;
  ```

  Without `_page.ts` the page is named after its folder.

Start a screen with the CLI. It writes the file from a template (and `_page.ts` for a new page), and prints the URL:

```bash
bun run lienzo new onboarding settings --size iphone
```

A new file appears on the open canvas without a restart, and every edit hot-reloads.

## A screen file

```tsx
import { useState } from "react";
import { Go } from "@/lienzo/go";
import type { ScreenMeta } from "@/lienzo/screens";

export const meta = { name: "Settings", size: "iphone", order: 3 } satisfies ScreenMeta;

export default function Screen() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex h-full flex-col gap-4 bg-white p-6">
      <button onClick={() => setOn(!on)}>{on ? "On" : "Off"}</button>
      <Go to="onboarding/home" className="rounded-lg bg-black px-4 py-3 text-white">Done</Go>
    </div>
  );
}
```

- The default export is a React component styled with Tailwind CSS. It fills its frame: use `h-full`, not `h-screen`.
- `meta.name` is the label above the frame and in the sidebar.
- `meta.size` is a preset or `{ width, height }` in CSS pixels:

  | Preset    | Size     |
  | --------- | -------- |
  | `iphone`  | 402×874  |
  | `android` | 412×917  |
  | `desktop` | 1440×900 |

- Position: give `x` and `y` (canvas pixels) to place the frame yourself. Without them, screens go in a row, left to right, by `order` (lower first) and then by id.
- The **Device** menu in the top bar (or `D`) shows every screen of the page as an iPhone, an Android phone or a desktop, on the canvas and in Play; `&device=desktop` in the URL opens that view. *As designed* goes back to each file's own size and position.
- To make a screen adapt to the device, use container queries: `@3xl:grid-cols-2` applies from 768 px of frame width (`@sm:` 384 px, `@lg:` 512 px, `@5xl:` 1024 px). Every frame is the container. Plain `sm:` and `lg:` follow the browser window, not the frame, so they don't adapt here. `example/web` is an example.
- A screen can use real React state for its own interactions: tabs, toggles, a sheet that opens. On the canvas, screens are pictures; in Play mode they are live.

## Go

`<Go to="page/screen">` is a button that moves to another screen in Play mode. It takes every `<button>` prop. `to` is always the full `page/screen`, written as a plain string, so the check can read it.

## Check

```bash
bun run lienzo check
```

It fails when an id isn't a slug or is used twice, a `meta` is missing or has a bad size, or a `Go` points at a screen that doesn't exist. `bun run lienzo list` prints every page and screen with its URL, and runs the same check.
