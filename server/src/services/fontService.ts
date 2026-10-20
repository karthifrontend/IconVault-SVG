// Building an icon font from a project's icons. Icons keep a stable codepoint (so a font rebuilt later puts every glyph on the same character): icons that already have one keep it, the others get the next free Private Use character, and for editors those new codepoints are saved on the icons. The fonts, CSS, SCSS, glyph map and specimen page come from `fantasticon`; ZIP packaging uses fflate. Builds run in a temporary folder that is removed afterwards; a package an editor downloads is also kept in the font build history (see fontHistory.ts).
import { zipSync } from "fflate";
import { FontAssetType, OtherAssetType, generateFonts } from "fantasticon";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isFontCodepoint } from "../lib/codepoint.js";
import { BadRequestError, ConflictError } from "../lib/errors.js";
import type { BuildFontInput } from "../lib/validation.js";
import Icon from "../models/Icon.js";
import mongoose, { type Types } from "mongoose";
import { descendantIds } from "./folderService.js";

type Id = Types.ObjectId;

export const MAX_FONT_ICONS = 1000;
// The basic-plane Private Use Area: 6400 characters.
const PUA_START = 0xe000;
const PUA_END = 0xf8ff;

export type FontIcon = { id: string; name: string; slug: string; svg: string; codepoint: string | null; hasStroke: boolean; hasGradient: boolean; hasText: boolean };

export type CodepointPlan = {
  // Every icon id mapped to its codepoint number.
  all: Map<string, number>;
  // The icons that did not have one and got a new one.
  assigned: Map<string, number>;
};

export const toHex = (n: number): string => n.toString(16).toUpperCase().padStart(4, "0");

// Pure: keeps existing codepoints, and gives the others the next free character from `startHex`, wrapping around the Private Use Area. `usedElsewhere` holds codepoints of icons that are not in this build but share the project (they must not be reused).
export function planCodepoints(icons: Pick<FontIcon, "id" | "codepoint">[], startHex: string, usedElsewhere: Iterable<number> = []): CodepointPlan {
  const used = new Set<number>(usedElsewhere);
  const all = new Map<string, number>();
  for (const icon of icons) {
    if (icon.codepoint) {
      const n = parseInt(icon.codepoint, 16);
      all.set(icon.id, n);
      used.add(n);
    }
  }
  const assigned = new Map<string, number>();
  let cursor = Math.min(Math.max(parseInt(startHex, 16) || PUA_START, PUA_START), PUA_END);
  const first = cursor;
  let wrapped = false;
  for (const icon of icons) {
    if (all.has(icon.id)) continue;
    // Find the next free character, wrapping once around the area.
    for (;;) {
      if (cursor > PUA_END) {
        if (wrapped) throw new ConflictError("The Private Use Area has no free characters left. Remove some icons or clear codepoints.");
        wrapped = true;
        cursor = PUA_START;
      }
      if (wrapped && cursor >= first) throw new ConflictError("The Private Use Area has no free characters left. Remove some icons or clear codepoints.");
      if (!used.has(cursor)) break;
      cursor += 1;
    }
    used.add(cursor);
    all.set(icon.id, cursor);
    assigned.set(icon.id, cursor);
    cursor += 1;
  }
  return { all, assigned };
}

export function conversionWarnings(icons: Pick<FontIcon, "name" | "hasStroke" | "hasGradient" | "hasText">[]) {
  const warnings: { icon: string; message: string }[] = [];
  for (const icon of icons) {
    if (icon.hasStroke) warnings.push({ icon: icon.name, message: "Uses strokes. Icon fonts need filled shapes, so the outline may come out thin or missing until the strokes are turned into outlines." });
    if (icon.hasGradient) warnings.push({ icon: icon.name, message: "Uses a gradient. A font glyph has one colour." });
    if (icon.hasText) warnings.push({ icon: icon.name, message: "Contains text. Turn the text into outlines first." });
  }
  return warnings;
}

// The icons a build covers: everything, one folder with its subfolders, or a chosen list. Trashed icons are never included.
export async function iconsForFont(projectId: Id, input: BuildFontInput): Promise<FontIcon[]> {
  const filter: Record<string, unknown> = { projectId, deletedAt: null };
  if (input.scope === "folder") {
    const folder = input.folderId as string;
    const root = new mongoose.Types.ObjectId(folder);
    filter.folderId = { $in: [root, ...(await descendantIds(projectId, root))] };
  } else if (input.scope === "selected") {
    filter._id = { $in: input.iconIds };
  }
  const rows = await Icon.find(filter).select({ name: 1, slug: 1, svg: 1, codepoint: 1, hasStroke: 1, hasGradient: 1, hasText: 1 }).sort({ slug: 1 }).limit(MAX_FONT_ICONS + 1).lean();
  if (rows.length === 0) throw new BadRequestError("There are no icons to put in the font.");
  if (rows.length > MAX_FONT_ICONS) throw new BadRequestError(`A font can hold ${MAX_FONT_ICONS} icons at most here. Choose a folder or select fewer icons.`);
  return rows.map((row) => ({ id: String(row._id), name: row.name, slug: row.slug, svg: row.svg, codepoint: row.codepoint ?? null, hasStroke: row.hasStroke ?? false, hasGradient: row.hasGradient ?? false, hasText: row.hasText ?? false }));
}

export type FontFile = { name: string; data: Buffer };

export type FontBuild = {
  fontName: string;
  prefix: string;
  iconCount: number;
  warnings: { icon: string; message: string }[];
  // The shared class, when one was asked for (the stylesheet then needs class="base prefix-name").
  baseClass: string;
  codepoints: { id: string; name: string; slug: string; codepoint: string; className: string; isNew: boolean }[];
  css: string;
  // Everything that goes into the ZIP: the requested font files, css, scss, json, html and a README.
  files: FontFile[];
  // A small font for the in-browser preview (always present).
  preview: { format: "woff2"; base64: string };
  sizes: Record<string, number>;
};

export function safeFontName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "") || "IconFont";
}

// Builds the font in a temporary folder. When `persist` is true the codepoints that were newly assigned are saved on the icons.
export async function buildFont(projectId: Id, icons: FontIcon[], input: BuildFontInput, persist: boolean): Promise<FontBuild> {
  // A character outside E000 to F8FF would be written to the wrong place in the font, so the CSS and the font would disagree. Such values can only exist from before this rule; say which icons to fix instead of building something wrong.
  const outside = icons.filter((icon) => icon.codepoint && !isFontCodepoint(icon.codepoint));
  if (outside.length > 0) {
    throw new BadRequestError(`These icons have a character outside E000 to F8FF, which the font cannot hold: ${outside.slice(0, 5).map((icon) => `${icon.name} (${icon.codepoint})`).join(", ")}${outside.length > 5 ? `, and ${outside.length - 5} more` : ""}. Change or clear it in the icon's details.`);
  }
  const inProject = await Icon.find({ projectId, deletedAt: null, codepoint: { $type: "string" }, _id: { $nin: icons.map((icon) => icon.id) } }).select({ codepoint: 1 }).lean();
  const plan = planCodepoints(icons, input.startCodepoint, inProject.map((row) => parseInt(row.codepoint as string, 16)));

  if (persist) {
    for (const [id, codepoint] of plan.assigned) {
      try {
        await Icon.updateOne({ _id: id, projectId, codepoint: null }, { $set: { codepoint: toHex(codepoint) } });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw new ConflictError("Another change took a codepoint while the font was being built. Please try again.");
        throw err;
      }
    }
  }

  const fontName = safeFontName(input.fontName);
  const prefix = input.prefix.replace(/-+$/, "") || "icon";
  const root = await mkdtemp(path.join(tmpdir(), "svgfont-"));
  try {
    const inDir = path.join(root, "in");
    const outDir = path.join(root, "out");
    await mkdir(inDir);
    await mkdir(outDir);
    const codepoints: Record<string, number> = {};
    for (const icon of icons) {
      await writeFile(path.join(inDir, `${icon.slug}.svg`), icon.svg, "utf8");
      codepoints[icon.slug] = plan.all.get(icon.id) as number;
    }

    const wanted = [...new Set(input.formats)];
    try {
      await generateFonts({
        inputDir: inDir,
        outputDir: outDir,
        name: fontName,
        // woff2 is always built for the preview; it is left out of the ZIP when not requested.
        fontTypes: [...new Set([...wanted, "woff2"])] as FontAssetType[],
        assetTypes: ["css", "scss", "json", "html"] as OtherAssetType[],
        formatOptions: { json: { indent: 2 } },
        codepoints,
        prefix,
        // A base class turns the shared rule into `.base:before` and each icon into `.base.prefix-name:before`.
        ...(input.baseClass ? { selector: `.${input.baseClass}` } : {}),
        fontHeight: input.fontHeight,
        descent: input.descent,
        normalize: input.normalize,
      });
    } catch (err) {
      throw new BadRequestError(`The font could not be built: ${err instanceof Error ? err.message : "unknown error"}`);
    }

    const files: FontFile[] = [];
    const sizes: Record<string, number> = {};
    let previewBase64 = "";
    for (const name of (await readdir(outDir)).sort()) {
      const data = await readFile(path.join(outDir, name));
      const ext = path.extname(name).slice(1).toLowerCase();
      if (ext === "woff2") previewBase64 = data.toString("base64");
      const isFont = ["ttf", "woff", "woff2", "eot", "svg"].includes(ext);
      if (isFont && !wanted.includes(ext as (typeof wanted)[number])) continue;
      files.push({ name, data });
      if (isFont) sizes[ext] = data.length;
    }
    files.push({ name: "README.md", data: Buffer.from(readme(fontName, prefix, icons, wanted, input.baseClass)) });

    const css = files.find((file) => file.name === `${fontName}.css`)?.data.toString("utf8") ?? "";
    return {
      fontName,
      prefix,
      baseClass: input.baseClass,
      iconCount: icons.length,
      warnings: conversionWarnings(icons),
      codepoints: icons.map((icon) => ({ id: icon.id, name: icon.name, slug: icon.slug, codepoint: toHex(plan.all.get(icon.id) as number), className: `${prefix}-${icon.slug}`, isNew: plan.assigned.has(icon.id) })),
      css,
      files,
      preview: { format: "woff2", base64: previewBase64 },
      sizes,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function readme(fontName: string, prefix: string, icons: FontIcon[], formats: string[], baseClass = ""): string {
  const sample = icons[0]?.slug ?? "icon";
  return `# ${fontName}\n\nAn icon font with ${icons.length} icons. Formats: ${formats.join(", ")}.\n\n## Use it\n\n1. Link the stylesheet:\n\n   <link rel="stylesheet" href="${fontName}.css">\n\n2. Add an icon:\n\n   <i class="${baseClass ? `${baseClass} ` : ""}${prefix}-${sample}"></i>\n\nOpen ${fontName}.html to see every icon with its class name. ${fontName}.json maps each icon to its character code, and stays the same when the font is rebuilt.\n`;
}

// A ZIP of the build's files (fonts, stylesheet, specimen and so on).
export function zipFontBuild(build: FontBuild): Buffer {
  const input: Record<string, Uint8Array> = {};
  for (const file of build.files) input[file.name] = new Uint8Array(file.data);
  return Buffer.from(zipSync(input, { level: 6 }));
}
