// The design check: every page and screen id is a slug and unique, every screen has a
// name and a valid size, and every `<Go to="page/screen">` points at a screen that exists.
// `bun run lienzo check` runs it on `designs/`; `ci:gate` fails when it reports anything.
import ts from "typescript";
import { isPreset, isSlug, screenPath } from "./screens";

export type DesignFile = { page: string; id: string; meta: unknown; source: string };
/** A `_` helper file, like `designs/app/_kit.tsx`: not a screen, but its `<Go>` links are checked too. */
export type HelperFile = { at: string; source: string };

/** Every `to` of a `<Go>` in a source file. A `to` that isn't a plain string comes back as `null`. */
export function goTargets(source: string): (string | null)[] {
  const targets: (string | null)[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === "Go"
    ) {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === "to") {
          targets.push(attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : null);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("design.tsx", source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX));
  return targets;
}

const isPositiveInt = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0;

/** What is wrong with a screen's `meta.size`, or `null` when it is a preset or whole `{ width, height }`. */
export function sizeProblem(size: unknown): string | null {
  if (isPreset(size)) return null;
  if (typeof size === "object" && size !== null && "width" in size && "height" in size) {
    return isPositiveInt(size.width) && isPositiveInt(size.height)
      ? null
      : "size width and height must be whole numbers above 0";
  }
  return `size must be a preset (iphone, android, desktop) or { width, height }, got ${JSON.stringify(size)}`;
}

/** Returns one line per problem, each starting with the screen or file it is about. Empty means all good. */
export function checkDesigns(files: readonly DesignFile[], helpers: readonly HelperFile[] = []): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const at = screenPath(file.page, file.id);
    if (!isSlug(file.page)) problems.push(`${at}: page folder "${file.page}" must be lowercase words joined by -`);
    if (!isSlug(file.id)) problems.push(`${at}: screen file "${file.id}" must be lowercase words joined by -`);
    if (seen.has(at)) problems.push(`${at}: two screens share this id`);
    seen.add(at);

    const meta = file.meta;
    if (typeof meta !== "object" || meta === null) {
      problems.push(`${at}: export const meta = { name, size } is missing`);
      continue;
    }
    if (!("name" in meta) || typeof meta.name !== "string" || !meta.name.trim()) {
      problems.push(`${at}: meta.name must be a non-empty string`);
    }
    const sizeError = sizeProblem("size" in meta ? meta.size : undefined);
    if (sizeError) problems.push(`${at}: ${sizeError}`);
  }

  const sources = [...files.map((f) => ({ at: screenPath(f.page, f.id), source: f.source })), ...helpers];
  for (const { at, source } of sources) {
    for (const to of goTargets(source)) {
      if (to === null) problems.push(`${at}: <Go to> must be a plain string like "page/screen"`);
      else if (!seen.has(to)) problems.push(`${at}: <Go to="${to}"> points at a screen that does not exist`);
    }
  }
  return problems;
}
