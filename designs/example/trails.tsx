import { useState } from "react";
import { Go } from "@/lienzo/go";
import type { ScreenMeta } from "@/lienzo/screens";
import { Mountains, Phone, TRAILS } from "./_kit";

export const meta = { name: "Trails", size: "iphone", order: 2 } satisfies ScreenMeta;

const LEVELS = ["All", "Easy", "Moderate", "Hard"] as const;

/** The trail list. The level chips are real state: in Play, tapping one filters the list. */
export default function Trails() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("All");
  const shown = TRAILS.filter((t) => level === "All" || t.level === level);

  return (
    <Phone className="bg-stone-100">
      <div className="px-6 pt-4">
        <p className="text-sm text-stone-500">Near Pine Valley</p>
        <h1 className="text-3xl font-bold">Trails</h1>
        <div className="mt-4 flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${l === level ? "bg-stone-900 text-white" : "bg-white text-stone-700"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4 px-6">
        {shown.map((t) => (
          <Go key={t.name} to="example/trail" className="overflow-hidden rounded-3xl bg-white text-left shadow-sm">
            <div className={`h-24 bg-linear-to-br ${t.tint}`}>
              <Mountains className="h-full w-full text-white/40" />
            </div>
            <div className="flex items-end justify-between p-4">
              <div>
                <p className="text-lg font-semibold">{t.name}</p>
                <p className="text-sm text-stone-500">{t.place}</p>
              </div>
              <p className="text-right text-sm text-stone-600">
                {t.km} km · {t.hours}
                <br />
                <span className="font-medium text-stone-900">{t.level}</span>
              </p>
            </div>
          </Go>
        ))}
      </div>
    </Phone>
  );
}
