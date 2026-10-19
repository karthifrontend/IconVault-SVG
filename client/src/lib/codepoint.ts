// Icon-font codepoints must sit in a Unicode Private Use Area, so a glyph can never replace a real character. Mirrors the server's rule (server/src/lib/codepoint.ts).

export function isPrivateUseCodepoint(hex: string): boolean {
  if (!/^[0-9a-fA-F]{4,6}$/.test(hex)) return false;
  const n = parseInt(hex, 16);
  return (n >= 0xe000 && n <= 0xf8ff) || (n >= 0xf0000 && n <= 0xffffd) || (n >= 0x100000 && n <= 0x10fffd);
}

// An error message for what the user typed, or null when it is fine (blank is fine: it clears the codepoint).
export function codepointProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return null;
  if (!/^[0-9a-fA-F]{4,6}$/.test(value)) return "Use 4 to 6 hex digits, for example E001.";
  if (!isPrivateUseCodepoint(value)) return "Use a private-use value (E000 to F8FF) so it cannot replace a real character.";
  return null;
}
