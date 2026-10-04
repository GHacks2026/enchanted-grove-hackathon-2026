// Finds a stored evidence quote in the journal text as the user wrote it, for display.
// Quotes were saved with spacing collapsed and curly quotes straightened (lib/grounding.ts),
// so match any run of whitespace and either style of quote mark.
export function findInText(text: string, quote: string): { start: number; end: number } | null {
  const pattern = quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+").replace(/"/g, '["“”]').replace(/'/g, "['‘’]");
  const m = new RegExp(pattern).exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
