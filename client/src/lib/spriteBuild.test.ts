// Tests for turning icons into a sprite and a sprite back into icons.
import { describe, expect, it } from "vitest";
import { buildSprite, spriteToFiles, svgToSymbol, symbolId } from "./spriteBuild";

// jsdom files have no .text(), so read them the old way.
const readFile = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });

const svg = (body: string, attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe("svgToSymbol", () => {
  it("keeps the viewBox and moves root paint attributes onto a group", () => {
    const symbol = svgToSymbol(svg('<path d="M0 0h1"/>'), "fth-a");
    expect(symbol?.id).toBe("fth-a");
    expect(symbol?.viewBox).toBe("0 0 24 24");
    expect(symbol?.inner).toMatch(/^<g fill="none" stroke="currentColor"><path /);
    expect(symbol?.inner).toContain('d="M0 0h1"');
  });

  it("builds a viewBox from width and height, or 24 by 24", () => {
    expect(svgToSymbol(svg("<g/>", 'width="16" height="32"'), "x")?.viewBox).toBe("0 0 16 32");
    expect(svgToSymbol(svg("<g/>", ""), "x")?.viewBox).toBe("0 0 24 24");
  });

  it("returns null for something that is not an SVG", () => {
    expect(svgToSymbol("not svg", "x")).toBeNull();
    expect(svgToSymbol("<svg><", "x")).toBeNull();
  });
});

describe("buildSprite", () => {
  it("makes one symbol per icon, with the prefix, sorted by id", () => {
    const built = buildSprite(
      [
        { name: "Star", slug: "star", svg: svg("<path/>") },
        { name: "Home", slug: "home", svg: svg("<path/>") },
      ],
      "fth",
    );
    expect(built.ids).toEqual(["fth-home", "fth-star"]);
    expect(built.xml).toContain('<symbol id="fth-home" viewBox="0 0 24 24">');
    expect(built.xml).toContain('<symbol id="fth-star"');
    expect(built.skipped).toEqual([]);
  });

  it("reports icons it could not read and still builds the rest", () => {
    const built = buildSprite([{ name: "Bad", slug: "bad", svg: "nope" }, { name: "Ok", slug: "ok", svg: svg("<path/>") }], "p");
    expect(built.skipped).toEqual(["Bad"]);
    expect(built.ids).toEqual(["p-ok"]);
  });

  it("builds an empty sprite from no icons", () => {
    expect(buildSprite([], "p").ids).toEqual([]);
  });

  it("uses the id shown in the icon drawer", () => {
    expect(symbolId("feather", "arrow-right")).toBe("feather-arrow-right");
  });
});

describe("spriteToFiles", () => {
  const sprite = buildSprite([{ name: "Home", slug: "home", svg: svg('<path d="M1 1"/>') }, { name: "Star", slug: "star", svg: svg("<circle/>") }], "fth").xml;

  it("splits a sprite into one svg file per symbol and drops this project's prefix", async () => {
    const result = spriteToFiles(sprite, "fth");
    expect(result?.count).toBe(2);
    expect(result?.files.map((file) => file.name)).toEqual(["home.svg", "star.svg"]);
    const text = await readFile(result!.files[0]!);
    expect(text).toContain('viewBox="0 0 24 24"');
    expect(text).toContain('d="M1 1"');
    expect(text.startsWith("<svg")).toBe(true);
  });

  it("keeps the whole id when it does not start with the project prefix", () => {
    expect(spriteToFiles(sprite, "other")?.files.map((file) => file.name)).toEqual(["fth-home.svg", "fth-star.svg"]);
  });

  it("returns null for a plain icon or a broken document", () => {
    expect(spriteToFiles(svg("<path/>"), "fth")).toBeNull();
    expect(spriteToFiles("garbage", "fth")).toBeNull();
  });
});
