// Every page and screen under designs/, found by Turbopack's import.meta.glob: a new file
// shows up on the canvas without a restart, and an edit hot-reloads.
import { byOrder, parseDesignPath, titleOf, type PageMeta, type Screen, type ScreenModule } from "./screens";

const screenModules = import.meta.glob<ScreenModule>(["/designs/*/*.tsx", "!/designs/*/_*.tsx"], {
  eager: true,
});
const pageModules = import.meta.glob<{ page: PageMeta }>("/designs/*/_page.ts", { eager: true });

export type Page = { id: string; name: string; screens: Screen[] };

export function loadPages(): Page[] {
  const screens = Object.entries(screenModules).flatMap(([file, mod]) => {
    const ids = parseDesignPath(file);
    return ids ? [{ ...ids, meta: mod.meta, Component: mod.default }] : [];
  });
  const pageIds = [...new Set(screens.map((s) => s.page))].sort();
  return pageIds.map((id) => ({
    id,
    name: pageModules[`/designs/${id}/_page.ts`]?.page.name ?? titleOf(id),
    screens: screens.filter((s) => s.page === id).sort(byOrder),
  }));
}
