// Shared parts of the Trailhead example: the trail data, a phone status bar and the mountain art.
import type { ReactNode } from "react";

export const TRAILS = [
  { name: "Ridge Loop", place: "Pine Valley", km: 8.4, hours: "3 h", level: "Moderate", tint: "from-emerald-400 to-teal-600" },
  { name: "Lake Path", place: "Blue Hollow", km: 4.1, hours: "1 h 20", level: "Easy", tint: "from-sky-400 to-indigo-500" },
  { name: "Summit Trail", place: "Granite Peak", km: 12.9, hours: "6 h", level: "Hard", tint: "from-amber-400 to-rose-500" },
] as const;

/** A phone screen with an iOS-style status bar. `dark` puts white text on a dark background. */
export function Phone({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`relative flex h-full flex-col overflow-hidden ${dark ? "text-white" : "text-stone-900"} ${className}`}>
      <div className="flex h-12 shrink-0 items-center justify-between px-7 pt-2 text-[15px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-current" />
        </span>
      </div>
      {children}
    </div>
  );
}

/** Layered mountains, used as a header and as the trail map. */
export function Mountains({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <path d="M0 200 L90 70 L150 140 L230 40 L320 130 L400 80 L400 200 Z" fill="currentColor" opacity=".35" />
      <path d="M0 200 L60 120 L130 170 L210 100 L290 165 L360 125 L400 150 L400 200 Z" fill="currentColor" opacity=".6" />
      <path d="M0 200 L0 175 L80 155 L170 185 L250 160 L330 180 L400 170 L400 200 Z" fill="currentColor" />
    </svg>
  );
}
