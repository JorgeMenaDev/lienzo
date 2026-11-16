import { useState } from "react";
import { Go } from "@/lienzo/go";
import type { ScreenMeta } from "@/lienzo/screens";
import { Mountains, Phone, TRAILS } from "./_kit";

export const meta = { name: "A trail", size: "iphone", order: 3 } satisfies ScreenMeta;

const trail = TRAILS[0];

export default function Trail() {
  const [saved, setSaved] = useState(false);

  return (
    <Phone dark className={`bg-linear-to-br ${trail.tint}`}>
      <div className="flex items-center justify-between px-6 pt-2">
        <Go to="example/trails" aria-label="Back" className="grid size-10 place-items-center rounded-full bg-white/20 text-xl">
          ‹
        </Go>
        <button onClick={() => setSaved(!saved)} className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium">
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <div className="px-6 pt-10">
        <p className="text-sm font-medium text-white/80">{trail.place}</p>
        <h1 className="text-4xl font-bold">{trail.name}</h1>
      </div>
      <Mountains className="mt-auto h-40 w-full text-white" />
      <div className="flex flex-col gap-6 bg-white px-6 pt-2 pb-12 text-stone-900">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Distance", `${trail.km} km`],
            ["Time", trail.hours],
            ["Level", trail.level],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-stone-100 py-3">
              <p className="text-xs text-stone-500">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-stone-600">
          A loop along the ridge with views over the valley. Steep for the first kilometre, then easy going. Water at the
          halfway hut.
        </p>
        <button className="rounded-2xl bg-stone-900 py-4 text-lg font-semibold text-white">Start the walk</button>
      </div>
    </Phone>
  );
}
