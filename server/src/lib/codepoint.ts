// Icon-font codepoints must sit in a Unicode Private Use Area, so a glyph can never replace a real character such as "A".

// The three Private Use Areas: E000-F8FF (basic plane) and the two supplementary planes.
export function isPrivateUseCodepoint(hex: string): boolean {
  if (!/^[0-9a-fA-F]{4,6}$/.test(hex)) return false;
  const n = parseInt(hex, 16);
  return (n >= 0xe000 && n <= 0xf8ff) || (n >= 0xf0000 && n <= 0xffffd) || (n >= 0x100000 && n <= 0x10fffd);
}
