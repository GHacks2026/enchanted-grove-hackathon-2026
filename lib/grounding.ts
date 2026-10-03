// Grounding validation. Source of truth: CONTRACT.md §6.
// Validation proves a quote exists in the journal, not that it was interpreted correctly.

export function normalize(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Offsets refer to normalize(journalBody). The stored evidence_quote is normalize(quote).
export function findQuote(
  journalBody: string,
  quote: string,
): { start: number; end: number } | null {
  const q = normalize(quote);
  if (q === "") return null; // indexOf("") would match at 0
  const start = normalize(journalBody).indexOf(q);
  if (start === -1) return null;
  return { start, end: start + q.length };
}
