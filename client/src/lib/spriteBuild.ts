// Turns a project's icons into a sprite and a sprite back into icons. Building uses the compiler's existing in-browser engine (symbol ids, sprite document, grid sprite, demo page); this file only adapts project icons to it. Each icon becomes one <symbol> with the id `<project prefix>-<slug>`, the same id the icon drawer shows.
import { buildSpriteXml, extractSymbolsFromSprite, sortSymbolsById, type SpriteSymbol } from "../utils/buildDemo";

export type SpriteIconInput = { name: string; slug: string; svg: string };

export type BuiltSprite = {
  xml: string;
  ids: string[];
  // Names of icons that could not be turned into a symbol (the SVG could not be read).
  skipped: string[];
};

// Reads an icon's SVG into a symbol. The root's presentation attributes (fill, stroke, ...) move onto a wrapping <g> so they survive inside the symbol. Returns null when the markup is not an SVG.
export function svgToSymbol(svgText: string, id: string): SpriteSymbol | null {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return null;
  let viewBox = svg.getAttribute("viewBox") || "";
  if (!viewBox) {
    const width = parseFloat(svg.getAttribute("width") || "24") || 24;
    const height = parseFloat(svg.getAttribute("height") || "24") || 24;
    viewBox = `0 0 ${width} ${height}`;
  }
  const ignored = new Set(["id", "width", "height", "xmlns", "xmlns:xlink", "version", "class", "viewBox"]);
  const attributes = Array.from(svg.attributes)
    .filter((attribute) => !ignored.has(attribute.name))
    .map((attribute) => ` ${attribute.name}="${attribute.value.replace(/"/g, "&quot;")}"`)
    .join("");
  return { id, viewBox, inner: `<g${attributes}>${svg.innerHTML}</g>` };
}

export function symbolId(prefix: string, slug: string): string {
  return `${prefix}-${slug}`;
}

export function buildSprite(icons: SpriteIconInput[], prefix: string): BuiltSprite {
  const symbols: SpriteSymbol[] = [];
  const skipped: string[] = [];
  for (const icon of icons) {
    const symbol = svgToSymbol(icon.svg, symbolId(prefix, icon.slug));
    if (symbol) symbols.push(symbol);
    else skipped.push(icon.name);
  }
  const sorted = sortSymbolsById(symbols);
  return { xml: buildSpriteXml(sorted), ids: sorted.map((symbol) => symbol.id), skipped };
}

export type SpriteImport = {
  files: File[];
  // How many symbols the sprite holds (the same as files.length).
  count: number;
};

// The file name an imported symbol gets: its id without the project's own prefix, so importing a sprite that came from this project does not double the prefix.
function importName(id: string, prefix: string): string {
  const stripped = id.startsWith(`${prefix}-`) && id.length > prefix.length + 1 ? id.slice(prefix.length + 1) : id;
  return `${stripped}.svg`;
}

// Splits a sprite document into one standalone SVG file per <symbol>, ready for the normal upload (which cleans, optimizes and handles name clashes). Returns null when the text is not a sprite.
export function spriteToFiles(spriteText: string, prefix: string): SpriteImport | null {
  const symbols = extractSymbolsFromSprite(spriteText);
  if (symbols.length === 0) return null;
  const files = symbols.map((symbol) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symbol.viewBox}">${symbol.inner}</svg>`;
    return new File([svg], importName(symbol.id, prefix), { type: "image/svg+xml" });
  });
  return { files, count: files.length };
}
