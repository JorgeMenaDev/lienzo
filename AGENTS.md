# Lienzo

A design canvas you talk to. A person describes a screen or a flow, an agent writes it as files under `designs/`, and the web app shows every page of screens on an infinite canvas with zoom, pan and a Play mode that clicks through the flow. There are no editing tools in the app: a change is a prompt, then a file edit.

Stack: Bun, Next.js (App Router) with TypeScript, Tailwind CSS, and UI SDK (`@ui-sdk/react`, `@ui-sdk/core`) for the canvas behaviours. Before using UI SDK, follow the `ui-sdk` skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`. To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `rendering.md` next to it.

## Writing designs

Most work here is writing designs, not changing the app. Read `designs/README.md` first, then:

- `bun run lienzo list` prints every page and screen with its URL.
- `bun run lienzo new <page> <screen> [--size iphone]` starts a screen from the template.
- `bun run lienzo check` runs the design check. Run it after every design change.
- `bun run lienzo ref <page>/<screen> <x> <y>` prints a reference to a point of a screen.

The person points at a part of a screen with ⌥-click and pastes a reference like `example/trails (designs/example/trails.tsx) · button "Ridge Loop Pine Valley 8.4 km · 3 h Moderate" · 354×176 at (24, 192) · http://localhost:3000/example?screen=trails&pin=120,260 · note: make this card shorter`. Search the design file for the quoted text to find the line. The box and pin are in the screen's own pixels, and the URL draws a marker at the pin.

## Changing the app

- `bun install`, then `bun run dev` serves the app on port 3000 (`PORT=4100 bun run dev` for another). `/` opens the first page.
- Prove a canvas change in the browser: drag and scroll to pan, Ctrl/⌘ + scroll or pinch to zoom, `Shift+1` to fit, a screen in the sidebar, the URL, then `P` for Play and Escape back. Put a screenshot in the PR.
- `bun run ci:gate` runs lint, typecheck, the design check, the tests (`bun run test`) and the build. Run it before each push.
- The app is in `lienzo/`: `canvas.ts` is the UI SDK canvas primitive, `lienzo.tsx` the sidebar, canvas and Play, `point.tsx` the ⌥-click pointing, `reference.ts` the reference format the app and CLI share, `screens.ts` sizes and layout, `check.ts` the design check. The CLI is `scripts/lienzo.ts`.
- No backend, no accounts and no keys: Lienzo runs locally.

## Coding preferences

- Keep things simple. Nothing speculative, no abstraction for single-use code.
- Type safety is useful: prefer inference, never `any`.
- Every changed line traces to the request. Remove what your change makes obsolete, in the same change.
- Tests are focused and go through a module's interface.
- Comments say how a function is used, briefly, and stay in sync with the code.
- Bun only. No npm, pnpm or yarn.
- Pull request titles use conventional commits: `feat: …`, `fix: …`. A PR description opens with the problem, then how the change solves it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
