import { Go } from "@/lienzo/go";
import type { ScreenMeta } from "@/lienzo/screens";
import { Mountains, Phone } from "./_kit";

export const meta = { name: "Welcome", size: "iphone", order: 1 } satisfies ScreenMeta;

export default function Welcome() {
  return (
    <Phone dark className="bg-linear-to-b from-indigo-950 via-indigo-800 to-orange-400">
      <div className="flex flex-1 flex-col px-7 pt-16">
        <p className="text-sm font-semibold tracking-[0.2em] text-orange-200 uppercase">Trailhead</p>
        <h1 className="mt-4 text-5xl leading-[1.05] font-bold">Find a walk that fits your day.</h1>
        <p className="mt-5 text-lg text-indigo-100">Trails near you, sorted by time, distance and how hard they are.</p>
      </div>
      <Mountains className="h-56 w-full text-stone-900" />
      <div className="flex flex-col gap-3 bg-stone-900 px-7 pt-2 pb-12">
        <Go to="example/trails" className="rounded-2xl bg-orange-400 py-4 text-lg font-semibold text-stone-900">
          Show trails near me
        </Go>
        <p className="text-center text-sm text-stone-400">No account needed.</p>
      </div>
    </Phone>
  );
}
