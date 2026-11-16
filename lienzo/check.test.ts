import { describe, expect, test } from "bun:test";
import { checkDesigns, type DesignFile } from "./check";
import { byOrder, layout } from "./screens";

const screen = (page: string, id: string, meta: unknown, source = ""): DesignFile => ({ page, id, meta, source });
const iphone = { name: "Now", size: "iphone" };

describe("design check", () => {
  test("a page whose Go links all land passes", () => {
    const files = [
      screen("app", "welcome", iphone, `<Go to="app/now" className="pbtn">Start</Go>`),
      screen("app", "now", { name: "Now", size: { width: 390, height: 844 } }, `<Go\n  to="app/welcome">Back</Go>`),
    ];
    expect(checkDesigns(files)).toEqual([]);
  });

  test("a Go target that does not exist fails", () => {
    expect(checkDesigns([screen("app", "now", iphone, `<Go to="app/settings">x</Go>`)])).toEqual([
      `app/now: <Go to="app/settings"> points at a screen that does not exist`,
    ]);
  });

  test("a Go target after an arrow-function prop is still checked", () => {
    expect(checkDesigns([screen("app", "now", iphone, `<Go onClick={() => save()} to="app/gone">x</Go>`)])).toEqual([
      `app/now: <Go to="app/gone"> points at a screen that does not exist`,
    ]);
  });

  test("Go links in helper files are checked too", () => {
    const kit = { at: "designs/app/_kit.tsx", source: `export const Nav = () => <Go to="app/gone" />;` };
    expect(checkDesigns([screen("app", "now", iphone)], [kit])).toEqual([
      `designs/app/_kit.tsx: <Go to="app/gone"> points at a screen that does not exist`,
    ]);
  });

  test("a Go target that is not a plain string fails", () => {
    expect(checkDesigns([screen("app", "now", iphone, `<Go to={target}>x</Go>`)])).toEqual([
      `app/now: <Go to> must be a plain string like "page/screen"`,
    ]);
  });

  test("ids must be slugs and unique", () => {
    const problems = checkDesigns([
      screen("App", "now", iphone),
      screen("app", "Sign_in", iphone),
      screen("app", "home", iphone),
      screen("app", "home", iphone),
    ]);
    expect(problems).toEqual([
      `App/now: page folder "App" must be lowercase words joined by -`,
      `app/Sign_in: screen file "Sign_in" must be lowercase words joined by -`,
      "app/home: two screens share this id",
    ]);
  });

  test("sizes must be a preset or whole positive width and height", () => {
    const problems = checkDesigns([
      screen("app", "a", { name: "A", size: "ipad" }),
      screen("app", "b", { name: "B", size: { width: 0, height: 800 } }),
      screen("app", "c", { name: "C" }),
      screen("app", "d", undefined),
    ]);
    expect(problems).toEqual([
      `app/a: size must be a preset (iphone, android, desktop) or { width, height }, got "ipad"`,
      "app/b: size width and height must be whole numbers above 0",
      "app/c: size must be a preset (iphone, android, desktop) or { width, height }, got undefined",
      "app/d: export const meta = { name, size } is missing",
    ]);
  });
});

describe("layout", () => {
  test("screens without a position go left to right by order, after placed ones", () => {
    const screens = [
      { id: "b", meta: { name: "B", size: "iphone" as const, order: 2 } },
      { id: "z", meta: { name: "Z", size: "desktop" as const, x: -2000, y: 300 } },
      { id: "a", meta: { name: "A", size: "android" as const, order: 1 } },
    ].sort(byOrder);
    expect(screens.map((s) => s.id)).toEqual(["a", "b", "z"]);
    expect(layout(screens)).toEqual([
      { x: -480, y: 0, width: 412, height: 917 },
      { x: 12, y: 0, width: 402, height: 874 },
      { x: -2000, y: 300, width: 1440, height: 900 },
    ]);
  });
});
