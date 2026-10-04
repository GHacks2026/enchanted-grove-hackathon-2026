"use client";

// Journal (issue #12) and review, in a side panel beside the Grove (app/(grove)/layout.tsx).
// The user writes about their day, POST /api/journals finds grounded blooms and friction,
// then the user reviews them (edit, change tree, remove) and confirms (CONTRACT §8, CONTEXT §6).
// Nothing reaches the Grove until confirm. Typed only (DECISIONS.md).
// On 502 nothing was saved, so the text stays on screen and "Try again" sends it again.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { confirmExtraction, getGrove, RequestError, submitJournal } from "@/lib/client";
import type { GrovePillar, JournalResult } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { findInText } from "@/lib/findInText";
import CloseIcon from "@/components/CloseIcon";
import TornSheet from "./TornSheet";
import Fleuron from "@/components/Fleuron";
import LeafMark from "@/components/tree/LeafMark";

const DRAFT_KEY = "sprout:journal-draft";
// A reviewed-but-unconfirmed entry, so closing the panel doesn't lose it.
// The draft is kept until confirm too, so the user can go back and edit the entry.
const PENDING_KEY = "sprout:pending-review";
const STEPS = ["Reading your entry", "Looking for things you did"];
const STARTERS = ["Today I worked on ", "Something that got in the way was ", "One small thing I did was "];

// Highlights glow softly around the words rather than filling a hard box. box-decoration-clone
// gives each wrapped line its own glow.
const GLOW = "rounded-md [box-decoration-break:clone] transition-[background-color,box-shadow] duration-700";
const GLOW_OFF = "bg-transparent shadow-none";
const GLOW_GREEN = "bg-lichen/20 shadow-[0_0_10px_4px_rgba(157,178,124,.45)]";
// A leaf's quote takes its tree's colour (set as --tree), like the journal panel; knots are bark brown
const GLOW_TREE = "bg-[color-mix(in_srgb,var(--tree)_22%,transparent)] shadow-[0_0_10px_4px_color-mix(in_srgb,var(--tree)_45%,transparent)]";
const GLOW_KNOT = "bg-[#6B4E3A]/15 shadow-[0_0_10px_4px_rgba(107,78,58,.35)]";
const MARK_TREE = "bg-[color-mix(in_srgb,var(--tree)_30%,transparent)]";
const treeStyle = (color: string | null) => (color ? ({ "--tree": color } as CSSProperties) : undefined);
const GLOW_AMBER = "bg-amber/15 shadow-[0_0_10px_4px_rgba(233,180,76,.4)]";
// Found quotes are swept in left to right (the fill grows across the words), then glow
const SHADOW_TREE = "shadow-[0_0_10px_4px_color-mix(in_srgb,var(--tree)_45%,transparent)]";
const SHADOW_GREEN = "shadow-[0_0_10px_4px_rgba(157,178,124,.45)]";
const SHADOW_KNOT = "shadow-[0_0_10px_4px_rgba(107,78,58,.35)]";
// The title and the entry keep these names through every step, so a view transition glides them
// from where they were to where they are now (writing -> reading -> found -> review, and back)
const TITLE_VT = { viewTransitionName: "journal-title" } as CSSProperties;
const ENTRY_VT = { viewTransitionName: "journal-entry" } as CSSProperties;

/** Switch steps with a view transition where supported (and motion is welcome); otherwise just switch. */
function morph(update: () => void) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  document.startViewTransition(() => flushSync(update));
}

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

/** After reading: the grounded quotes, highlighted in the user's own text as they're revealed. Each
 *  one is swept in left to right, and a small leaf in its tree's colour (or a bark dot, for a knot)
 *  sprouts at its end. */
function foundHighlights(text: string, result: JournalResult, revealed: number, treeColor: (pillarId: string | null) => string | null): ReactNode[] {
  const spans = result.items.flatMap((item, order) => {
    const at = findInText(text, item.evidence_quote);
    return at ? [{ ...at, kind: item.kind, order, color: item.kind === "bloom" ? treeColor(item.final_pillar_id) : null }] : [];
  }).sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    out.push(text.slice(pos, s.start));
    const on = s.order < revealed, bloom = s.kind === "bloom";
    const fill = bloom ? (s.color ? `color-mix(in srgb, ${s.color} 24%, transparent)` : "rgb(157 178 124 / .22)") : "rgb(107 78 58 / .16)";
    out.push(
      <mark key={s.start}
        style={{ ...treeStyle(s.color), backgroundImage: `linear-gradient(${fill}, ${fill})`, backgroundSize: on ? "100% 100%" : "0% 100%" }}
        className={`rounded-md bg-transparent bg-no-repeat text-ink [box-decoration-break:clone] transition-[background-size,box-shadow] duration-[650ms,1000ms] ease-out ${on ? (bloom ? (s.color ? SHADOW_TREE : SHADOW_GREEN) : SHADOW_KNOT) : "shadow-none"}`}>
        {text.slice(s.start, s.end)}
      </mark>,
    );
    if (on) out.push(bloom
      ? <LeafMark key={`m${s.start}`} color={s.color ?? "var(--color-lichen)"} size={13} className="animate-sprout ml-0.5 inline-block origin-bottom-left align-[-1px] [animation-delay:450ms]" />
      : <span key={`m${s.start}`} aria-hidden className="animate-sprout ml-1 inline-block size-1.5 rounded-full bg-[#6B4E3A] align-middle [animation-delay:450ms]" />);
    pos = s.end;
  }
  out.push(text.slice(pos));
  return out;
}

/** The entry on the review screen: each kept item's quote marked (green growth, brown knot, amber for a
 *  followed Lantern); the card being hovered turns its quote bold so the user can see exactly which
 *  words it came from. */
function reviewHighlights(text: string, result: JournalResult, drafts: Record<string, Draft>, hovered: string | null, treeColor: (pillarId: string | null) => string | null): ReactNode[] {
  const spans = result.items.flatMap(item => {
    if (drafts[item.id]?.removed) return [];
    const at = findInText(text, item.evidence_quote);
    // A leaf follows the tree picked in review, so changing the tree changes the colour here too
    return at ? [{ ...at, kind: item.kind as string, id: item.id, color: item.kind === "bloom" ? treeColor(drafts[item.id]?.pillarId ?? null) : null }] : [];
  });
  // The followed Lantern's quote often is a growth quote too; then that mark stands for both
  const followed = result.lantern_followed ? findInText(text, result.lantern_followed.evidence_quote) : null;
  const overlapsLantern = (s: { start: number; end: number }) => !!followed && s.start < followed.end && s.end > followed.start;
  if (followed && !spans.some(overlapsLantern)) spans.push({ ...followed, kind: "lantern", id: "lantern", color: null });
  spans.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    out.push(text.slice(pos, s.start));
    const on = hovered === s.id || (hovered === "lantern" && overlapsLantern(s));
    out.push(
      <mark key={s.start} style={treeStyle(s.color)}
        className={`rounded-sm px-0.5 text-ink [box-decoration-break:clone] ${on ? "font-bold" : ""} ${s.kind === "bloom" ? (s.color ? MARK_TREE : "bg-lichen/30") : s.kind === "lantern" ? "bg-amber/35" : "bg-[#6B4E3A]/20"}`}>
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
  const [pillars, setPillars] = useState<GrovePillar[]>([]);
  const treeColor = (pillarId: string | null) => {
    const p = pillarId ? pillars.find(x => x.id === pillarId) : undefined;
    return p ? pillarColor(p.position) : null;
  };
  const [status, setStatus] = useState<Status>({ kind: "writing" });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0); // which sentence the reading highlight is on
  const [revealed, setRevealed] = useState(0); // how many found quotes are highlighted so far
  const [hovered, setHovered] = useState<string | null>(null); // review card whose quote glows in the entry
  const [hint, setHint] = useState("");
  const [lantern, setLantern] = useState<string | null>(null); // the last Lantern, null before the first confirm
  const [showLantern, setShowLantern] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sendId = useRef(0); // bumped by "Edit reflection" so a reply that's still on its way is ignored

  // Restore an unsent draft or an unconfirmed review, and load the trees for the review
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending) startReview(JSON.parse(pending));
      setBody(sessionStorage.getItem(DRAFT_KEY) ?? "");
    } catch { /* storage blocked */ }
    getGrove().then(g => { setPillars(g?.pillars ?? []); setLantern(g?.lantern ?? null); }).catch(() => {});
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
    const t = setInterval(() => morph(() => setStep(s => Math.min(s + 1, STEPS.length - 1))), 1500);
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
    const next = setTimeout(() => morph(() => startReview(result)), n ? 350 + n * 450 + 1300 : 0);
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

  // The review's cards rise in one after another as it opens (after the title and entry have glided
  // into place); later, e.g. undoing a prune, a card simply appears in place.
  const reviewAt = useRef(0);
  const arrive = (i: number): CSSProperties => ({ animationDelay: `${performance.now() - reviewAt.current < 1200 ? 260 + i * 80 : 0}ms` });

  function startReview(result: JournalResult) {
    reviewAt.current = performance.now();
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
    morph(() => setStatus({ kind: "sending", text }));
    const id = ++sendId.current;
    try {
      const result = await submitJournal(text);
      if (id !== sendId.current) return; // the user went back to edit while Sprout was reading
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(result)); } catch { /* ignore */ }
      morph(() => setStatus({ kind: "found", result, text }));
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
      done(confirmed.filter(i => i.kind === "bloom"), !!result.lantern_followed);
    } catch (e) {
      // 409: already confirmed (e.g. sent twice), so it's in the Grove
      if (e instanceof RequestError && e.status === 409) return done([], false);
      setStatus({ kind: "review", result, error: e instanceof RequestError ? e.message : "Couldn't add these right now. Try again." });
    }
  }

  // Back to the Grove, which refreshes and flies each new leaf from its review card to its tree.
  // The note (read by GroveCanvas) lists the leaves in order, with where each card was on screen.
  function done(newLeaves: { id: string; final_pillar_id: string | null }[], lanternFollowed: boolean) {
    try {
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      const leaves = newLeaves.filter(i => i.final_pillar_id).map(i => {
        const r = document.getElementById(`review-${i.id}`)?.getBoundingClientRect();
        return { pillarId: i.final_pillar_id!, from: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null };
      });
      if (leaves.length) sessionStorage.setItem("sprout:new-leaves", JSON.stringify({ leaves }));
      if (lanternFollowed) sessionStorage.setItem("sprout:lantern-followed", "1"); // the Grove lights the Lantern up
    } catch { /* ignore */ }
    router.push("/");
  }

  // Back to the entry to change it. Saving again reads it afresh; the unconfirmed reading
  // stays stored (CONTEXT §10) but never reaches the Grove.
  // Also works while Sprout is still reading or highlighting: the reply, if it comes, is ignored.
  function editEntry() {
    sendId.current++;
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
    morph(() => setStatus({ kind: "writing" }));
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
      className="grid size-10 flex-none place-items-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink"><CloseIcon /></Link>
  );

  return (
    <TornSheet aria-label="Reflect on your day" z="z-50" className="flex flex-col">
      <div style={{ viewTransitionName: "journal-sheet" }} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-color:var(--color-page-edge)_transparent] [scrollbar-width:thin]">
      {status.kind === "sending" || status.kind === "found" ? (
        <section role="status" aria-live="polite">
          <button type="button" onClick={editEntry}
            className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-moss hover:text-ink">
            ‹ Edit reflection
          </button>
          <h1 className="m-0 font-heading text-title" style={TITLE_VT}>
            {status.kind === "sending" ? `${STEPS[step]}…` : "What sprouted today"}
          </h1>
          <p className="mt-1 mb-4 text-sm text-ink-soft">Nothing is added to your Grove until you review it.</p>
          <p className="paper-inset m-0 rounded-md px-4 py-3.5 text-lg leading-relaxed whitespace-pre-wrap text-ink" style={ENTRY_VT}>
            {status.kind === "sending" ? readingSweep(status.text, tick) : foundHighlights(status.text, status.result, revealed, treeColor)}
          </p>
        </section>
      ) : status.kind === "review" || status.kind === "confirming" ? (
        <section>
          <button type="button" onClick={editEntry} disabled={status.kind === "confirming"}
            className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-moss hover:text-ink disabled:cursor-default disabled:opacity-50">
            ‹ Edit reflection
          </button>
          <header className="relative mb-5 px-8 text-center">
            <h1 className="m-0 font-heading text-title" style={TITLE_VT}>What sprouted today</h1>
            <p className="mt-1 mb-0 text-sm text-ink-soft">Tend to anything that isn&apos;t quite right. Nothing is planted until you say so.</p>
            <Fleuron className="mx-auto mt-3" />
            <div className="absolute -top-1 -right-2">{closeButton}</div>
          </header>

          {/* The entry itself, with each kept item's quote marked: every quote is shown in place, in the
              user's own words. Hovering a card below makes its quote bold here. */}
          {body.trim() && (status.result.items.length > 0 || status.result.lantern_followed) && (
            <>
              <p className="m-0 font-label text-sm font-bold text-ink-soft">Your entry</p>
              <p className="mt-1 mb-1.5 paper-inset max-h-44 overflow-y-auto rounded-md px-3 py-2 font-display text-quote whitespace-pre-wrap" style={ENTRY_VT}>
                {reviewHighlights(body, status.result, drafts, hovered, treeColor)}
              </p>
            </>
          )}
          {status.result.items.length > 0 && <p className="mt-0 mb-4 text-sm text-ink-soft">{foundSummary(status.result)}</p>}

          {/* Closing the loop: this entry shows the user did their last Lantern, quoted in their words */}
          {status.result.lantern_followed && (
            <div onMouseEnter={() => setHovered("lantern")} onMouseLeave={() => setHovered(h => (h === "lantern" ? null : h))}
              style={arrive(0)} className="animate-card-in mb-3 flex gap-3 rounded-md border border-amber/50 bg-amber/15 px-4 py-3">
              <svg aria-hidden viewBox="0 0 12 16" width="18" height="24" className="mt-0.5 flex-none text-[#5A4130]">
                <path d="M6 .6v1.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <rect x="3" y="2.4" width="6" height="1.6" rx=".6" fill="currentColor" />
                <rect x="2.4" y="4.2" width="7.2" height="8.2" rx="2.4" fill="#F6C66A" stroke="currentColor" strokeWidth="1" />
                <rect x="3.5" y="12.6" width="5" height="1.6" rx=".6" fill="currentColor" />
              </svg>
              <div>
                <p className="m-0 font-bold">You followed your Lantern ✓</p>
                <p className="mt-0.5 mb-1 text-sm text-ink-soft">{status.result.lantern_followed.lantern}</p>
                <p className="m-0 font-display text-sm italic text-ink-soft">
                  &ldquo;{status.result.lantern_followed.evidence_quote}&rdquo;
                  <span title="Sprout checked that these exact words are in your entry. It never makes up a quote."
                    className="ml-1.5 font-body text-[11px] font-bold whitespace-nowrap text-moss not-italic">✓ in your words</span>
                </p>
              </div>
            </div>
          )}

          {status.result.items.length === 0 && (
            <p className="paper-inset rounded-md px-4 py-3 text-ink-soft">
              Nothing sprouted from this entry, and that&apos;s okay. Some days are for rest.
            </p>
          )}

          <ul className="m-0 grid list-none gap-3 p-0">
            {status.result.items.map((item, i) => {
              const d = drafts[item.id];
              const isBloom = item.kind === "bloom";
              const edited = d.interpretation !== item.original_interpretation || d.pillarId !== item.original_pillar_id;
              if (d.removed) return (
                <li key={item.id} className="animate-fade-in flex items-center justify-between rounded-md border border-dashed border-page-edge px-4 py-2.5 text-sm text-ink-soft">
                  <span>Pruned: {d.interpretation || item.original_interpretation}</span>
                  <button type="button" onClick={() => edit(item.id, { removed: false })}
                    className="cursor-pointer border-0 bg-transparent p-0 font-bold text-moss underline underline-offset-2 hover:text-ink">Undo</button>
                </li>
              );
              return (
                <li key={item.id} id={`review-${item.id}`}
                  onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(h => (h === item.id ? null : h))}
                  onFocus={() => setHovered(item.id)} onBlur={() => setHovered(h => (h === item.id ? null : h))}
                  style={arrive(i + 1)} className={`animate-card-in rounded-md border px-4 py-3 ${isBloom ? "border-lichen/50 bg-lichen/10" : "border-[#E5D2A8] bg-[#F7EEDB]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-label text-sm font-bold ${isBloom ? "text-moss" : "text-[#6E4E12]"}`}>
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
                  <p className="mt-1 mb-2 font-display text-quote text-ink-soft">
                    &ldquo;{item.evidence_quote}&rdquo;
                    <span title="Sprout checked that these exact words are in your entry. It never makes up a quote."
                      className="ml-1.5 font-body text-xs font-bold whitespace-nowrap text-moss not-italic">✓ in your words</span>
                  </p>
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    Tree
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: d.pillarId ? pillarColor(pillars.find(p => p.id === d.pillarId)?.position ?? 0) : "transparent" }} />
                    <select value={d.pillarId ?? ""} onChange={e => edit(item.id, { pillarId: e.target.value || null })}
                      className="flex-1 cursor-pointer rounded-md border border-page-edge bg-page-light px-2 py-1 text-ink">
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
                style={arrive(status.result.items.length + 1)}
                className="animate-card-in mt-5 w-full press cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-wait disabled:opacity-70">
                {status.kind === "confirming" ? "Growing…" : leaves ? `Grow ${leaves} ${leaves === 1 ? "leaf" : "leaves"}` : "Done"}
              </button>
            );
          })()}
        </section>
      ) : (
        <section>
          <header className="relative mb-5 px-8 text-center">
            <h1 className="m-0 font-heading text-title" style={TITLE_VT}>Reflect on your day</h1>
            <p className="mt-1 mb-0 font-display text-ink-soft italic">{today}</p>
            <Fleuron className="mx-auto mt-3" />
            <div className="absolute -top-1 -right-2">{closeButton}</div>
          </header>

          {status.kind === "failed" && (
            <div role="alert" className="mb-4 rounded-md border border-berry/40 bg-berry/10 px-4 py-3">
              <p className="m-0 font-bold text-[#7D2846]">That didn&apos;t go through</p>
              <p className="mt-0.5 mb-0 text-sm">{status.message}</p>
              {status.noGrove && <Link href="/" className="font-bold text-moss underline">Create your Grove first</Link>}
            </div>
          )}

          <label htmlFor="journal-text" className="sr-only">Your journal entry</label>
          {/* The word count sits inside the box, bottom right; extra bottom padding keeps text clear of it */}
          <div className="relative" style={ENTRY_VT}>
            <textarea
              id="journal-text"
              ref={textRef}
              value={body}
              onChange={e => { setBody(e.target.value); saveDraft(e.target.value); if (hint) setHint(""); }}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
              placeholder="What did you do today? What got in the way? Write it however it comes out."
              className="ruled paper-inset max-h-[60vh] min-h-[248px] w-full resize-none rounded-md px-4 py-3.5 text-lg leading-[1.875rem] text-ink [--rule-offset:.875rem] [--rule:1.875rem] outline-none placeholder:text-[#8C8A96] focus:border-moss focus:shadow-[0_0_0_3px_rgba(157,178,124,.55)] pb-9"
            />
            <span className="pointer-events-none absolute right-4 bottom-3 text-xs text-ink-soft" aria-live="polite">{words ? `${words} word${words === 1 ? "" : "s"}` : ""}</span>
          </div>
          {hint && <p role="alert" className="mt-2 mb-0 text-sm text-berry">{hint}</p>}

          <footer className="mt-4 flex flex-wrap items-center justify-end gap-4">
            <button type="button" onClick={send}
              className="press cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber w-full">
              {status.kind === "failed" ? "Try again" : "Save"}
            </button>
          </footer>

          {/* The last Lantern, hidden until asked for. Pressing it starts a sentence the user finishes in
              their own words, so a followed Lantern is still found from (and quoted in) the entry. */}
          {lantern ? (
            <div className="mt-4">
              <button type="button" aria-expanded={showLantern} onClick={() => setShowLantern(v => !v)}
                className="cursor-pointer border-0 bg-transparent p-0 text-sm text-ink-soft hover:text-ink">
                Did you follow your last Lantern? <span aria-hidden>{showLantern ? "▴" : "▾"}</span>
              </button>
              {showLantern && (
                // The suggestion is plain text (so it can be selected and copied); only the line below adds it
                <div className="mt-2 rounded-lg border border-amber/60 bg-amber/15 px-3 py-2 text-sm text-ink">
                  <p className="m-0">{lantern}</p>
                  <button type="button" onClick={() => addStarter("For my last Lantern, I ")}
                    className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-moss underline decoration-moss/40 underline-offset-2 hover:text-ink hover:decoration-ink">Add it to your reflection</button>
                </div>
              )}
            </div>
          ) : !body.trim() && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-ink-soft">Need a starting point?</span>
              {STARTERS.map(s => (
                <button key={s} type="button" onClick={() => addStarter(s)}
                  className="cursor-pointer rounded-full border border-page-edge bg-page-light px-3 py-1 text-sm text-ink hover:border-moss">{s.trim()}…</button>
              ))}
            </div>
          )}
        </section>
      )}
      </div>
    </TornSheet>
  );
}
