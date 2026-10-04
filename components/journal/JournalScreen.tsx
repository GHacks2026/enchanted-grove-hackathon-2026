"use client";

// Journal (issue #12) and review, in a side panel beside the Grove (app/(grove)/layout.tsx).
// The user writes about their day, POST /api/journals finds grounded blooms and friction,
// then the user reviews them (edit, change tree, remove) and confirms (CONTRACT §8, CONTEXT §6).
// Nothing reaches the Grove until confirm. Typed only (DECISIONS.md).
// On 502 nothing was saved, so the text stays on screen and "Try again" sends it again.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { confirmExtraction, getGrove, RequestError, submitJournal } from "@/lib/client";
import type { GrovePillar, JournalResult } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { findInText } from "@/lib/findInText";

const DRAFT_KEY = "sprout:journal-draft";
// A reviewed-but-unconfirmed entry, so closing the panel doesn't lose it.
// The draft is kept until confirm too, so the user can go back and edit the entry.
const PENDING_KEY = "sprout:pending-review";
const STEPS = ["Reading your entry", "Looking for things you did", "Checking every quote against your words"];
const STARTERS = ["Today I worked on ", "Something that got in the way was ", "One small thing I did was "];

// Highlights glow softly around the words rather than filling a hard box. box-decoration-clone
// gives each wrapped line its own glow.
const GLOW = "rounded-md [box-decoration-break:clone] transition-[background-color,box-shadow] duration-700";
const GLOW_OFF = "bg-transparent shadow-none";
const GLOW_GREEN = "bg-lichen/20 shadow-[0_0_10px_4px_rgba(157,178,124,.45)]";
const GLOW_AMBER = "bg-amber/15 shadow-[0_0_10px_4px_rgba(233,180,76,.4)]";

/** While waiting: a soft highlight moves through the entry sentence by sentence. Decorative only;
 *  nothing is known until the server replies. */
function readingSweep(text: string, tick: number): ReactNode[] {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [text];
  const readable = sentences.map((t, i) => (t.trim() ? i : -1)).filter(i => i >= 0);
  const active = readable[tick % Math.max(1, readable.length)];
  return sentences.map((t, i) => (
    // Only the words glow, not the space or line break after them
    <span key={i}><span className={`${GLOW} ${i === active ? GLOW_AMBER : GLOW_OFF}`}>{t.trimEnd()}</span>{t.slice(t.trimEnd().length)}</span>
  ));
}

/** After reading: the grounded quotes, highlighted in the user's own text as they're revealed */
function foundHighlights(text: string, result: JournalResult, revealed: number): ReactNode[] {
  const spans = result.items.flatMap((item, order) => {
    const at = findInText(text, item.evidence_quote);
    return at ? [{ ...at, kind: item.kind, order }] : [];
  }).sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    out.push(text.slice(pos, s.start));
    const on = s.order < revealed;
    out.push(
      <mark key={s.start} className={`${GLOW} text-ink ${on ? (s.kind === "bloom" ? GLOW_GREEN : GLOW_AMBER) : GLOW_OFF}`}>
        {text.slice(s.start, s.end)}
      </mark>,
    );
    pos = s.end;
  }
  out.push(text.slice(pos));
  return out;
}

/** "3 leaves and 1 knot", for the top of the review */
function foundSummary(result: JournalResult) {
  const growth = result.items.filter(i => i.kind === "bloom").length, knots = result.items.length - growth;
  return [growth && `${growth} ${growth === 1 ? "leaf" : "leaves"}`, knots && `${knots} ${knots === 1 ? "knot" : "knots"}`].filter(Boolean).join(" and ");
}

type Status =
  | { kind: "writing" }
  | { kind: "sending"; text: string }
  | { kind: "found"; result: JournalResult; text: string }
  | { kind: "failed"; message: string; noGrove: boolean }
  | { kind: "review"; result: JournalResult; error?: string }
  | { kind: "confirming"; result: JournalResult };

type Draft = { interpretation: string; pillarId: string | null; removed: boolean };

export default function JournalScreen() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [pillars, setPillars] = useState<GrovePillar[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "writing" });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0); // which sentence the reading highlight is on
  const [revealed, setRevealed] = useState(0); // how many found quotes are highlighted so far
  const [hint, setHint] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sendId = useRef(0); // bumped by "Edit reflection" so a reply that's still on its way is ignored

  // Restore an unsent draft or an unconfirmed review, and show the goal as a gentle reminder
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending) startReview(JSON.parse(pending));
      setBody(sessionStorage.getItem(DRAFT_KEY) ?? "");
    } catch { /* storage blocked */ }
    getGrove().then(g => { setGoal(g?.grove.goal ?? null); setPillars(g?.pillars ?? []); }).catch(() => {});
    textRef.current?.focus();
  }, []);
  // Save the draft only when the user changes it. (An effect on `body` would also run with the empty
  // initial value and overwrite the saved draft before it's restored, e.g. under React Strict Mode.)
  const saveDraft = (text: string) => { try { sessionStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ } };

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
    setTick(0);
    const t = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 1500);
    const sweep = setInterval(() => setTick(n => n + 1), 750);
    return () => { clearInterval(t); clearInterval(sweep); };
  }, [status.kind]);

  // Once the entry is read, highlight each quote Sprout found in the text, one at a time,
  // then move on to the review cards.
  useEffect(() => {
    if (status.kind !== "found") return;
    const { result } = status;
    setRevealed(0);
    const n = result.items.length;
    const steps = Array.from({ length: n }, (_, i) => setTimeout(() => setRevealed(i + 1), 350 + i * 450));
    const next = setTimeout(() => startReview(result), n ? 350 + n * 450 + 1100 : 0);
    return () => { steps.forEach(clearTimeout); clearTimeout(next); };
  }, [status]);

  // Escape closes the panel, except mid-request so the result isn't lost
  const busy = status.kind === "sending" || status.kind === "found" || status.kind === "confirming";
  useEffect(() => {
    if (busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, router]);

  function startReview(result: JournalResult) {
    setDrafts(Object.fromEntries(result.items.map(i => [i.id, { interpretation: i.final_interpretation, pillarId: i.final_pillar_id, removed: false }])));
    setStatus({ kind: "review", result });
  }

  async function send() {
    const text = body.trim();
    if (!text) {
      setHint("Write a little about your day first. A sentence is enough.");
      textRef.current?.focus();
      return;
    }
    setStatus({ kind: "sending", text });
    const id = ++sendId.current;
    try {
      const result = await submitJournal(text);
      if (id !== sendId.current) return; // the user went back to edit while Sprout was reading
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(result)); } catch { /* ignore */ }
      setStatus({ kind: "found", result, text });
    } catch (e) {
      if (id !== sendId.current) return;
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

  async function confirm(result: JournalResult) {
    const missing = result.items.some(i => !drafts[i.id].removed && !drafts[i.id].interpretation.trim());
    if (missing) { setStatus({ kind: "review", result, error: "Each item you keep needs a few words about what it shows." }); return; }
    setStatus({ kind: "confirming", result });
    try {
      const { confirmed } = await confirmExtraction(result.extraction_id, result.items.map(i => {
        const d = drafts[i.id];
        return d.removed
          ? { id: i.id, action: "delete" as const, final_interpretation: i.final_interpretation, final_pillar_id: i.final_pillar_id }
          : { id: i.id, action: "keep" as const, final_interpretation: d.interpretation.trim(), final_pillar_id: d.pillarId };
      }));
      done(confirmed.filter(i => i.kind === "bloom"));
    } catch (e) {
      // 409: already confirmed (e.g. sent twice), so it's in the Grove
      if (e instanceof RequestError && e.status === 409) return done([]);
      setStatus({ kind: "review", result, error: e instanceof RequestError ? e.message : "Couldn't add these right now. Try again." });
    }
  }

  // Back to the Grove, which refreshes and flies each new leaf from its review card to its tree.
  // The note (read by GroveCanvas) lists the leaves in order, with where each card was on screen.
  function done(newLeaves: { id: string; final_pillar_id: string | null }[]) {
    try {
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      const leaves = newLeaves.filter(i => i.final_pillar_id).map(i => {
        const r = document.getElementById(`review-${i.id}`)?.getBoundingClientRect();
        return { pillarId: i.final_pillar_id!, from: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null };
      });
      if (leaves.length) sessionStorage.setItem("sprout:new-leaves", JSON.stringify({ leaves }));
    } catch { /* ignore */ }
    router.push("/");
  }

  // Back to the entry to change it. Saving again reads it afresh; the unconfirmed reading
  // stays stored (CONTEXT §10) but never reaches the Grove.
  // Also works while Sprout is still reading or highlighting: the reply, if it comes, is ignored.
  function editEntry() {
    sendId.current++;
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
    setStatus({ kind: "writing" });
  }

  function addStarter(s: string) {
    setBody(b => {
      const next = b && !/\s$/.test(b) ? `${b}\n\n${s}` : `${b}${s}`;
      saveDraft(next);
      return next;
    });
    setHint("");
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  const edit = (id: string, change: Partial<Draft>) => setDrafts(d => ({ ...d, [id]: { ...d[id], ...change } }));
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const closeButton = (
    <Link href="/" aria-label="Back to your Grove"
      className="grid size-10 flex-none place-items-center rounded-lg text-3xl leading-none text-ink-soft hover:bg-ink/10 hover:text-ink">×</Link>
  );

  return (
    <aside aria-label="Reflect on your day"
      className="animate-drawer fixed top-0 right-0 bottom-0 z-50 w-[min(440px,100%)] overflow-y-auto bg-panel px-5 py-5 text-ink shadow-[-20px_0_50px_-20px_rgba(10,8,30,.55)]">
      {status.kind === "sending" || status.kind === "found" ? (
        <section role="status" aria-live="polite">
          <button type="button" onClick={editEntry}
            className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-moss hover:text-ink">
            ‹ Edit reflection
          </button>
          <h1 className="m-0 font-display text-3xl leading-tight font-normal">
            {`${STEPS[status.kind === "sending" ? step : STEPS.length - 1]}…`}
          </h1>
          <p className="mt-1 mb-4 text-sm text-ink-soft">Nothing is added to your Grove until you review it.</p>
          <p className="m-0 rounded-2xl bg-field px-4 py-3.5 text-lg leading-relaxed whitespace-pre-wrap text-ink">
            {status.kind === "sending" ? readingSweep(status.text, tick) : foundHighlights(status.text, status.result, revealed)}
          </p>
        </section>
      ) : status.kind === "review" || status.kind === "confirming" ? (
        <section>
          <button type="button" onClick={editEntry} disabled={status.kind === "confirming"}
            className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-moss hover:text-ink disabled:cursor-default disabled:opacity-50">
            ‹ Edit reflection
          </button>
          <header className="mb-4 flex items-start gap-3">
            <div className="flex-1">
              <h1 className="m-0 font-display text-3xl leading-tight font-normal">What sprouted today</h1>
              <p className="mt-1 mb-0 text-sm text-ink-soft">Tend to anything that isn&apos;t quite right. Nothing is planted until you say so.</p>
            </div>
            {closeButton}
          </header>

          {status.result.items.length > 0 && <p className="mt-0 mb-3 text-sm text-ink-soft">{foundSummary(status.result)}</p>}

          {status.result.items.length === 0 && (
            <p className="rounded-xl bg-field px-4 py-3 text-ink-soft">
              Nothing sprouted from this entry, and that&apos;s okay. Some days are for rest.
            </p>
          )}

          <ul className="m-0 grid list-none gap-3 p-0">
            {status.result.items.map(item => {
              const d = drafts[item.id];
              const isBloom = item.kind === "bloom";
              const edited = d.interpretation !== item.original_interpretation || d.pillarId !== item.original_pillar_id;
              if (d.removed) return (
                <li key={item.id} className="flex items-center justify-between rounded-xl border border-dashed border-line px-4 py-2.5 text-sm text-ink-soft">
                  <span>Pruned: {d.interpretation || item.original_interpretation}</span>
                  <button type="button" onClick={() => edit(item.id, { removed: false })}
                    className="cursor-pointer border-0 bg-transparent p-0 font-bold text-moss underline underline-offset-2 hover:text-ink">Undo</button>
                </li>
              );
              return (
                <li key={item.id} id={`review-${item.id}`} className={`rounded-xl border px-4 py-3 ${isBloom ? "border-lichen/50 bg-lichen/10" : "border-[#E5D2A8] bg-[#F7EEDB]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-bold ${isBloom ? "text-moss" : "text-[#6E4E12]"}`}>
                      {isBloom ? "New growth" : "A knot"}
                      {edited && <span className="font-normal text-ink-soft"> · edited</span>}
                    </span>
                    <span className="flex gap-3 text-xs font-bold">
                      {edited && (
                        <button type="button" onClick={() => edit(item.id, { interpretation: item.original_interpretation, pillarId: item.original_pillar_id })}
                          aria-label={`Reset to Sprout's suggestion: ${item.original_interpretation}`}
                          className="cursor-pointer border-0 bg-transparent p-0 text-ink-soft underline underline-offset-2 hover:text-ink">Reset</button>
                      )}
                      <button type="button" onClick={() => { const el = document.getElementById(`interp-${item.id}`) as HTMLInputElement | null; el?.focus(); el?.select(); }}
                        aria-label={`Edit: ${d.interpretation}`}
                        className="cursor-pointer border-0 bg-transparent p-0 text-moss underline underline-offset-2 hover:text-ink">Edit</button>
                      <button type="button" onClick={() => edit(item.id, { removed: true })} aria-label={`Prune: ${d.interpretation}`}
                        className="cursor-pointer border-0 bg-transparent p-0 text-ink-soft underline underline-offset-2 hover:text-berry">Prune</button>
                    </span>
                  </div>
                  <label className="sr-only" htmlFor={`interp-${item.id}`}>What this shows</label>
                  <input id={`interp-${item.id}`} value={d.interpretation} onChange={e => edit(item.id, { interpretation: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 -mx-1.5 font-bold text-ink outline-none hover:border-line focus:border-moss focus:bg-field" />
                  <p className="mt-1 mb-2 font-display text-sm italic text-ink-soft">&ldquo;{item.evidence_quote}&rdquo;</p>
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    Tree
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: d.pillarId ? pillarColor(pillars.find(p => p.id === d.pillarId)?.position ?? 0) : "transparent" }} />
                    <select value={d.pillarId ?? ""} onChange={e => edit(item.id, { pillarId: e.target.value || null })}
                      className="flex-1 cursor-pointer rounded-lg border border-line bg-field px-2 py-1 text-ink">
                      {!isBloom && <option value="">No tree</option>}
                      {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>

          {status.kind === "review" && status.error && <p role="alert" className="mt-3 mb-0 text-sm text-berry">{status.error}</p>}

          {(() => {
            const leaves = status.result.items.filter(i => i.kind === "bloom" && !drafts[i.id].removed).length;
            return (
              <button type="button" onClick={() => confirm(status.result)} disabled={status.kind === "confirming"}
                className="mt-5 w-full cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-wait disabled:opacity-70">
                {status.kind === "confirming" ? "Growing…" : leaves ? `Grow ${leaves} ${leaves === 1 ? "leaf" : "leaves"}` : "Done"}
              </button>
            );
          })()}
        </section>
      ) : (
        <section>
          <header className="mb-4 flex items-start gap-3">
            <div className="flex-1">
              <h1 className="m-0 font-display text-3xl leading-tight font-normal">Reflect on your day</h1>
              <p className="mt-1 mb-0 text-ink-soft">{today}</p>
              {goal && <p className="m-0 text-sm text-ink-soft">Working toward: {goal}</p>}
            </div>
            {closeButton}
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
            onChange={e => { setBody(e.target.value); saveDraft(e.target.value); if (hint) setHint(""); }}
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
              {status.kind === "failed" ? "Try again" : "Save"}
            </button>
          </footer>
        </section>
      )}
    </aside>
  );
}
