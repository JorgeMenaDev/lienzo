// The agent side of Lienzo. Run it as `bun run lienzo <command>`:
//   list                                   every page and screen, with its local URL
//   new <page> <screen> [--size <size>]    write a screen from the template and print its URL
//   check                                  the design check; exits 1 when it finds a problem
//   ref <page>/<screen> <x> <y>            a reference to that point of the screen, to paste in chat
import { Glob } from "bun";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { checkDesigns, sizeProblem, type DesignFile, type HelperFile } from "../lienzo/check";
import { designFile, formatReference } from "../lienzo/reference";
import { byOrder, isPreset, isSlug, parseDesignPath, sizeOf, titleOf, type ScreenMeta } from "../lienzo/screens";

const DESIGNS = path.resolve(import.meta.dir, "../designs");
const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

const pageUrl = (page: string) => `${BASE}/${page}`;
const screenUrl = (page: string, id: string) => `${pageUrl(page)}?screen=${id}`;

const exported = (mod: unknown, name: string): unknown =>
  typeof mod === "object" && mod !== null && name in mod ? (mod as Record<string, unknown>)[name] : undefined;

/** Every screen file under designs/, with its meta read by importing it, plus the `_` helper files. Import errors become problems. */
async function loadDesigns() {
  const files: DesignFile[] = [];
  const helpers: HelperFile[] = [];
  const problems: string[] = [];
  for await (const rel of new Glob("*/*.tsx").scan(DESIGNS)) {
    const file = path.join(DESIGNS, rel);
    const source = await Bun.file(file).text();
    const ids = parseDesignPath(`designs/${rel}`);
    if (!ids) {
      helpers.push({ at: `designs/${rel}`, source });
      continue;
    }
    let meta: unknown;
    try {
      meta = exported(await import(file), "meta");
    } catch (error) {
      problems.push(`${ids.page}/${ids.id}: does not load: ${error instanceof Error ? error.message : String(error)}`);
    }
    files.push({ ...ids, meta, source });
  }
  return { files, helpers, problems };
}

async function pageName(page: string) {
  const file = path.join(DESIGNS, page, "_page.ts");
  if (!existsSync(file)) return titleOf(page);
  const meta = exported(await import(file), "page");
  const name = exported(meta, "name");
  return typeof name === "string" ? name : titleOf(page);
}

async function list() {
  const { files, helpers, problems } = await loadDesigns();
  const pages = [...new Set(files.map((f) => f.page))].sort();
  if (!pages.length) console.log("No pages yet. Add one with: bun run lienzo new <page> <screen>");
  for (const page of pages) {
    console.log(`${await pageName(page)}  ${pageUrl(page)}`);
    const screens = files
      .filter((f) => f.page === page)
      .map((f) => ({ id: f.id, meta: f.meta as ScreenMeta }))
      .sort(byOrder);
    for (const { id, meta } of screens) {
      const problem = sizeProblem(meta?.size);
      const size = problem ? null : sizeOf(meta.size);
      const sizeText = size ? `${isPreset(meta.size) ? `${meta.size} ` : ""}${size.width}×${size.height}` : problem;
      console.log(`  ${meta?.name ?? id} (${id}) · ${sizeText}  ${screenUrl(page, id)}`);
    }
  }
  report([...problems, ...checkDesigns(files, helpers)]);
}

function parseSize(value: string | undefined): ScreenMeta["size"] {
  if (value === undefined) return "iphone";
  if (isPreset(value)) return value;
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (match) return { width: Number(match[1]), height: Number(match[2]) };
  fail(`--size must be iphone, android, desktop or WIDTHxHEIGHT, like 390x844. Got "${value}".`);
}

function template(name: string, size: ScreenMeta["size"]) {
  return `import type { ScreenMeta } from "@/lienzo/screens";

export const meta = { name: ${JSON.stringify(name)}, size: ${JSON.stringify(size)} } satisfies ScreenMeta;

export default function Screen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-white text-neutral-900">
      <h1 className="text-2xl font-semibold">{meta.name}</h1>
      <p className="text-sm text-neutral-500">Describe this screen, then an agent writes it here.</p>
    </div>
  );
}
`;
}

async function create(args: string[]) {
  const sizeAt = args.indexOf("--size");
  const size = parseSize(sizeAt === -1 ? undefined : args[sizeAt + 1]);
  const [page, id] = args.filter((_, i) => sizeAt === -1 || (i !== sizeAt && i !== sizeAt + 1));
  if (!page || !id) fail("Usage: bun run lienzo new <page> <screen> [--size iphone|android|desktop|WIDTHxHEIGHT]");
  for (const slug of [page, id]) {
    if (!isSlug(slug)) fail(`"${slug}" must be lowercase words joined by -, like onboarding or sign-in.`);
  }
  const dir = path.join(DESIGNS, page);
  const file = path.join(dir, `${id}.tsx`);
  if (existsSync(file)) fail(`designs/${page}/${id}.tsx already exists.`);
  await mkdir(dir, { recursive: true });
  const pageFile = path.join(dir, "_page.ts");
  if (!existsSync(pageFile)) {
    await Bun.write(
      pageFile,
      `import type { PageMeta } from "@/lienzo/screens";\n\nexport const page = { name: ${JSON.stringify(titleOf(page))} } satisfies PageMeta;\n`,
    );
  }
  await Bun.write(file, template(titleOf(id), size));
  console.log(`Wrote designs/${page}/${id}.tsx`);
  console.log(screenUrl(page, id));
}

async function check() {
  const { files, helpers, problems } = await loadDesigns();
  report([...problems, ...checkDesigns(files, helpers)]);
  console.log(`Design check: ${files.length} screens, no problems.`);
}

/** The reference the app copies on ⌥-click, without the element part: the screen, its file and a pin URL. */
function ref(args: string[]) {
  const usage = "Usage: bun run lienzo ref <page>/<screen> <x> <y>, with x and y in the screen's pixels.";
  const [target = "", x = "", y = ""] = args;
  const [page = "", screen = ""] = target.split("/");
  if (!isSlug(page) || !isSlug(screen) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) fail(usage);
  if (!existsSync(path.join(DESIGNS, page, `${screen}.tsx`))) fail(`${designFile(page, screen)} does not exist.`);
  console.log(formatReference({ origin: BASE, page, screen, point: { x: Number(x), y: Number(y) } }));
}

function report(problems: string[]) {
  if (!problems.length) return;
  console.error(`Design check found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (command === "list") await list();
else if (command === "new") await create(args);
else if (command === "check") await check();
else if (command === "ref") ref(args);
else fail("Usage: bun run lienzo <list | new <page> <screen> [--size iphone] | check | ref <page>/<screen> <x> <y>>");
