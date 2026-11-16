"use client";

import { createContext, use, type ComponentProps } from "react";

/** Set by Play mode to move to another screen. On the canvas there is none, so `Go` does nothing. */
export const GoContext = createContext<((to: string) => void) | null>(null);

/**
 * A button that moves to another screen in Play mode: `<Go to="example/now">Start</Go>`.
 * `to` is always `page/screen` as a plain string, so `bun run lienzo check` can verify it exists.
 */
export function Go({ to, onClick, ...props }: { to: string } & ComponentProps<"button">) {
  const go = use(GoContext);
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) go?.(to);
      }}
    />
  );
}
