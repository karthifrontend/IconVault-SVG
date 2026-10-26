// Read-only mapping for the characters used by this font build.
import { Copy } from "lucide-react";
import type { FontCodepoint } from "../../api/types";
import { glyphChar } from "../../lib/fontPreview";

type CodepointTableProps = {
  glyphs: FontCodepoint[];
  family: string | null;
  onCopyClass: (className: string) => void;
};

export default function CodepointTable({ glyphs, family, onCopyClass }: CodepointTableProps) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-3xl text-left text-sm">
        <caption className="sr-only">Stable Unicode codepoints mapping</caption>
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-16 px-3 py-2 font-medium">Preview</th>
            <th scope="col" className="px-3 py-2 font-medium">Icon name</th>
            <th scope="col" className="px-3 py-2 font-medium">Slug</th>
            <th scope="col" className="px-3 py-2 font-medium">Assigned hex codepoint</th>
            <th scope="col" className="px-3 py-2 font-medium">CSS entity</th>
            <th scope="col" className="px-3 py-2 font-medium">CSS class</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {glyphs.map((glyph) => (
            <tr key={glyph.id} className="align-top">
              <td className="px-3 py-2"><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xl leading-none" style={family ? { fontFamily: `\"${family}\"` } : undefined}>{family ? glyphChar(glyph.codepoint) : "□"}</span></td>
              <td className="px-3 py-2 font-medium">{glyph.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{glyph.slug}</td>
              <td className="px-3 py-2 font-mono">U+{glyph.codepoint}{glyph.isNew && <span className="ml-1.5 rounded bg-primary/10 px-1 text-xs text-primary">new</span>}</td>
              <td className="px-3 py-2 font-mono text-xs">{`\\${glyph.codepoint.toLowerCase()}`}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><span className="max-w-48 truncate font-mono text-xs">{glyph.className}</span><button type="button" onClick={() => onCopyClass(glyph.className)} aria-label={`Copy class ${glyph.className}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><Copy aria-hidden="true" className="h-3.5 w-3.5" /></button></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
