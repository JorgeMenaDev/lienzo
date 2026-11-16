import { describe, expect, test } from "bun:test";
import { layout, type ScreenMeta } from "./screens";

// A placed desktop screen and two phones in the automatic row, as a page's files might say.
const screens: { meta: ScreenMeta }[] = [
  { meta: { name: "Home", size: "desktop", x: 0, y: 1000 } },
  { meta: { name: "Now", size: "iphone" } },
  { meta: { name: "Place", size: { width: 300, height: 600 } } },
];

describe("layout with a device", () => {
  test("gives every screen the device's size, in one row left to right, without overlaps", () => {
    expect(layout(screens, "android")).toEqual([
      { x: 0, y: 0, width: 412, height: 917 },
      { x: 492, y: 0, width: 412, height: 917 },
      { x: 984, y: 0, width: 412, height: 917 },
    ]);
  });

  test("as designed, each file keeps its own size and position", () => {
    expect(layout(screens, null)).toEqual([
      { x: 0, y: 1000, width: 1440, height: 900 },
      { x: 1520, y: 0, width: 402, height: 874 },
      { x: 2002, y: 0, width: 300, height: 600 },
    ]);
  });
});
