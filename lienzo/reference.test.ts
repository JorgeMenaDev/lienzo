import { describe, expect, test } from "bun:test";
import { formatReference, parsePin } from "./reference";

const card = {
  origin: "http://localhost:3000",
  page: "example",
  screen: "now",
  point: { x: 40.4, y: 319.6 },
  element: { tag: "button", text: "Ridge Loop\nPine Valley · 8.4 km", x: 16.2, y: 301.8, width: 272.4, height: 64.6 },
};

describe("formatReference", () => {
  test("names the screen, its file, the element, its box and a pin URL, in screen pixels rounded", () => {
    expect(formatReference(card)).toBe(
      'example/now (designs/example/now.tsx) · button "Ridge Loop Pine Valley · 8.4 km" · 272×65 at (16, 302) · http://localhost:3000/example?screen=now&pin=40,320',
    );
  });

  test("ends with the note, on one line, and leaves out an empty one", () => {
    expect(formatReference({ ...card, note: "  make this\ncard taller " })).toEndWith(" · note: make this card taller");
    expect(formatReference({ ...card, note: "   " })).toEndWith("&pin=40,320");
  });

  test("cuts the element's text to 60 characters, and drops the quotes when it has none", () => {
    const long = formatReference({ ...card, element: { ...card.element, text: "a".repeat(80) } });
    expect(long).toContain(`button "${"a".repeat(59)}…"`);
    expect(formatReference({ ...card, element: { ...card.element, tag: "svg", text: "" } })).toContain(" · svg · 272×65");
  });

  test("names the device the screen was shown as, and the URL opens that view", () => {
    expect(formatReference({ ...card, device: "desktop" })).toBe(
      'example/now (designs/example/now.tsx) · button "Ridge Loop Pine Valley · 8.4 km" · 272×65 at (16, 302) · as desktop 1440×900 · http://localhost:3000/example?screen=now&device=desktop&pin=40,320',
    );
  });

  test("without an element, as the CLI prints it", () => {
    const { origin, page, screen, point } = card;
    expect(formatReference({ origin, page, screen, point })).toBe(
      "example/now (designs/example/now.tsx) · http://localhost:3000/example?screen=now&pin=40,320",
    );
  });
});

describe("parsePin", () => {
  test("reads two whole numbers and refuses anything else", () => {
    expect(parsePin("16,302")).toEqual({ x: 16, y: 302 });
    for (const bad of [null, "", "16", "16,", "-1,2", "1.5,2", "a,b"]) expect(parsePin(bad)).toBeNull();
  });
});
