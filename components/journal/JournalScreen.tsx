"use client";

// Journal (issue #12): the user writes about their day, then POST /api/journals
// finds grounded blooms and friction for review (CONTRACT §8). Typed only (DECISIONS.md).
// On 502 nothing was saved, so the text stays on screen and "Try again" sends it again.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getGrove, RequestError, submitJournal } from "@/lib/client";
import type { JournalResult } from "@/lib/client";
import { Sky } from "@/components/grove/Atmosphere";

const DRAFT_KEY = "sprout:journal-draft";
const STEPS = ["Reading your entry", "Looking for things you did", "Checking every quote against your words"];
const STARTERS = ["Today I worked on ", "Something that got in the way was ", "One small thing I did was "];

type Status =
  | { kind: "writing" }
  | { kind: "sending" }
  | { kind: "failed"; message: string; noGrove: boolean }
  | { kind: "done"; result: JournalResult };

interface Props {
  /** Called with the grounded items. The review drawer takes it from here. */
  onResult?: (result: JournalResult, body: string) => void;
}

export default function JournalScreen({ onResult }: Props) {
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "writing" });
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Restore an unsent draft, and show the goal as a gentle reminder
  useEffect(() => {
    try { setBody(sessionStorage.getItem(DRAFT_KEY) ?? ""); } catch { /* storage blocked */ }
    getGrove().then(g => setGoal(g?.grove.goal ?? null)).catch(() => {});
    textRef.current?.focus();
  }, []);
  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, body); } catch { /* ignore */ } }, [body]);

  // Grow the text box with the writing
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`;
  }, [body, status.kind]);

  useEffect(() => {
    if (status.kind !== "sending") return;
    setStep(0);
    const t = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 1500);
    return () => clearInterval(t);
  }, [status.kind]);

  async function send() {
    const text = body.trim();
    if (!text) {
      setHint("Write a little about your day first. A sentence is enough.");
      textRef.current?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const result = await submitJournal(text);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      if (onResult) onResult(result, text);
      else setStatus({ kind: "done", result });
    } catch (e) {
      const status = e instanceof RequestError ? e.status : 0;
      setStatus({
        kind: "failed",
        noGrove: status === 404,
        message: status === 502
          ? "Sprout couldn't read your entry just now. Nothing was saved, and your words are still here."
          : e instanceof RequestError ? e.message : "Something went wrong. Your words are still here.",
      });
    }
  }

  function addStarter(s: string) {
    setBody(b => (b && !/\s$/.test(b) ? `${b}\n\n${s}` : `${b}${s}`));
    setHint("");
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const card = "relative w-full max-w-[760px] rounded-[22px] border border-line bg-panel px-6 py-6 text-ink shadow-[0_30px_70px_-36px_rgba(20,18,50,.8)] sm:px-8";

  return (
    <main className="bg-grove relative flex min-h-dvh items-start justify-center overflow-hidden px-3 py-6 sm:px-5 sm:py-12">
      <Sky moonOnPhones={false} />

      {status.kind === "sending" ? (
        <section className={`${card} py-14 text-center`} role="status" aria-live="polite">
          <div aria-hidden className="inline-flex gap-2">
            {["bg-moss", "bg-lichen", "bg-amber"].map((c, i) => (
              <span key={c} className={`size-3 rounded-full ${c} animate-seed-bob`} style={{ animationDuration: "0.6s", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="mt-5 mb-1 font-display text-2xl">{STEPS[step]}…</p>
          <p className="m-0 text-sm text-ink-soft">Nothing is added to your Grove until you review it.</p>
        </section>
      ) : status.kind === "done" ? (
        // Temporary: the review drawer replaces this in the next step.
        <section className={card}>
          <h1 className="m-0 font-display text-3xl font-normal">Entry read</h1>
          <p className="text-ink-soft">
            Found {status.result.items.filter(i => i.kind === "bloom").length} blooms and {status.result.items.filter(i => i.kind === "friction").length} friction.
            The review screen comes next.
          </p>
          <Link href="/" className="font-bold text-moss underline">Back to your Grove</Link>
        </section>
      ) : (
        <section className={card}>
          <header className="mb-4 flex items-start gap-4">
            <div className="flex-1">
              <h1 className="m-0 font-display text-4xl leading-tight font-normal sm:text-5xl">Reflect on your day</h1>
              <p className="mt-1.5 mb-0 text-ink-soft">{today}</p>
              {goal && <p className="m-0 text-sm text-ink-soft">Working toward: {goal}</p>}
            </div>
            <Link href="/" aria-label="Back to your Grove without sending"
              className="grid size-10 place-items-center rounded-lg text-3xl leading-none text-ink-soft hover:bg-ink/10 hover:text-ink">×</Link>
          </header>

          {status.kind === "failed" && (
            <div role="alert" className="mb-4 rounded-xl border border-berry/40 bg-berry/10 px-4 py-3">
              <p className="m-0 font-bold text-[#7D2846]">That didn&apos;t go through</p>
              <p className="mt-0.5 mb-0 text-sm">{status.message}</p>
              {status.noGrove && <Link href="/" className="font-bold text-moss underline">Create your Grove first</Link>}
            </div>
          )}

          <label htmlFor="journal-text" className="sr-only">Your journal entry</label>
          <textarea
            id="journal-text"
            ref={textRef}
            value={body}
            onChange={e => { setBody(e.target.value); if (hint) setHint(""); }}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
            placeholder="What did you do today? What got in the way? Write it however it comes out."
            className="max-h-[60vh] min-h-[220px] w-full resize-none rounded-2xl border-[1.5px] border-line bg-field px-4 py-3.5 text-lg leading-relaxed text-ink outline-none placeholder:text-[#8C8A96] focus:border-moss focus:shadow-[0_0_0_3px_rgba(233,180,76,.45)]"
          />
          {hint && <p role="alert" className="mt-2 mb-0 text-sm text-berry">{hint}</p>}

          {!body.trim() && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-ink-soft">Need a starting point?</span>
              {STARTERS.map(s => (
                <button key={s} type="button" onClick={() => addStarter(s)}
                  className="cursor-pointer rounded-full border border-line bg-field px-3 py-1 text-sm text-ink hover:border-moss">{s.trim()}…</button>
              ))}
            </div>
          )}

          <footer className="mt-5 flex flex-wrap items-center justify-end gap-4">
            <span className="text-sm text-ink-soft" aria-live="polite">{words ? `${words} word${words === 1 ? "" : "s"}` : ""}</span>
            <button type="button" onClick={send}
              className="cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber max-sm:w-full">
              {status.kind === "failed" ? "Try again" : "Send entry"}
            </button>
          </footer>
          <p className="mt-4 mb-0 text-sm text-ink-soft">
            Sprout looks for things you did and anything that got in the way. You review everything before it&apos;s added.
          </p>
        </section>
      )}
    </main>
  );
}
