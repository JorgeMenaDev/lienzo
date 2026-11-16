import { Go } from "@/lienzo/go";
import type { ScreenMeta } from "@/lienzo/screens";
import { Mountains, TRAILS } from "./_kit";

export const meta = { name: "trailhead.app", size: "desktop", order: 4 } satisfies ScreenMeta;

/**
 * The website, written to adapt: one column at phone widths, two from 768 px (`@3xl:`). It uses
 * container queries because the frame is the screen's window, not the browser's.
 */
export default function Web() {
  return (
    <div className="h-full overflow-y-auto bg-stone-50 text-stone-900 [scrollbar-width:none]">
      <header className="flex items-center justify-between px-6 py-5 @3xl:px-16">
        <span className="text-xl font-bold">Trailhead</span>
        <nav className="hidden items-center gap-8 text-sm @3xl:flex">
          <span>Trails</span>
          <span>Guides</span>
          <Go to="example/welcome" className="rounded-full bg-stone-900 px-5 py-2.5 font-medium text-white">
            Get the app
          </Go>
        </nav>
      </header>

      <section className="grid items-center gap-10 px-6 pt-6 pb-12 @3xl:grid-cols-2 @3xl:px-16 @3xl:pt-12">
        <div>
          <h1 className="text-4xl leading-[1.05] font-bold @3xl:text-6xl">Find a walk that fits your day.</h1>
          <p className="mt-5 text-lg text-stone-600 @3xl:max-w-md">
            Trails near you, sorted by time, distance and how hard they are. Pick one, go.
          </p>
          <Go to="example/welcome" className="mt-8 rounded-2xl bg-orange-400 px-7 py-4 text-lg font-semibold">
            Show trails near me
          </Go>
        </div>
        <div className="overflow-hidden rounded-[2rem] bg-linear-to-b from-indigo-900 to-orange-400">
          <Mountains className="mt-24 h-56 w-full text-stone-900" />
        </div>
      </section>

      <section className="grid gap-4 px-6 pb-16 @3xl:grid-cols-3 @3xl:px-16">
        {TRAILS.map((t) => (
          <div key={t.name} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className={`h-2 w-12 rounded-full bg-linear-to-r ${t.tint}`} />
            <p className="mt-4 text-lg font-semibold">{t.name}</p>
            <p className="text-sm text-stone-500">
              {t.place} · {t.km} km · {t.level}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
