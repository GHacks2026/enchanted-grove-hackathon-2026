import { describe, it, expect } from "vitest";
import { findQuote, normalize } from "./grounding";

const journal =
  "Today I spent an hour rewriting the introduction to my portfolio case study. Then I rested.";

describe("findQuote", () => {
  it("exact match returns offsets into the normalized body", () => {
    const quote = "rewriting the introduction to my portfolio case study";
    const r = findQuote(journal, quote);
    expect(r).not.toBeNull();
    expect(normalize(journal).slice(r!.start, r!.end)).toBe(quote);
  });

  it("curly vs straight quotes match in both directions", () => {
    expect(findQuote("I said “let’s go” to Sam.", `I said "let's go"`)).toEqual({ start: 0, end: 17 });
    expect(findQuote(`I said "let's go" to Sam.`, "I said “let’s go”")).toEqual({ start: 0, end: 17 });
  });

  it("extra whitespace and newlines still match", () => {
    const body = "I finished   my\n\nhomepage\tlayout today.";
    const r = findQuote(body, "finished my homepage layout");
    expect(r).not.toBeNull();
    expect(normalize(body).slice(r!.start, r!.end)).toBe("finished my homepage layout");
  });

  it("paraphrase fails", () => {
    expect(findQuote(journal, "I rewrote the intro of my portfolio case study")).toBeNull();
  });

  it("quote not in journal fails", () => {
    expect(findQuote(journal, "emailed a recruiter")).toBeNull();
  });

  it("empty quote fails", () => {
    expect(findQuote(journal, "")).toBeNull();
    expect(findQuote(journal, "  \n ")).toBeNull();
  });

  it("quote appearing twice returns the first index", () => {
    const body = "I practiced. Later, I practiced.";
    expect(findQuote(body, "I practiced")).toEqual({ start: 0, end: 11 });
  });
});
