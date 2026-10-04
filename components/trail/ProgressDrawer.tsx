"use client";

// A tree's progress (issue #3, Evidence Trail): every leaf on the tree, newest first,
// with the date, what it means, and the user's own words. Read-only (CONTRACT §8, §9).
// Each quote is shown italic with its quote marks inside the highlight; it can expand to the full journal
// entry, all italic, with this tree's quotes highlighted.
// Set on the same paper page as the journal (JournalHistory).
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getTrail, RequestError } from "@/lib/client";
import type { GrovePillar, TrailData, TrailEntry } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { findInText } from "@/lib/findInText";
import { jumpDate, useJumpTo } from "@/components/useJumpTo";
import CloseIcon from "@/components/CloseIcon";
import Fleuron from "@/components/Fleuron";
import LeafMark from "@/components/tree/LeafMark";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** The quote's highlight, like the journal's: the tree's colour for a leaf, bark brown for a knot */
const markStyle = (tint: string, amount: number) =>
  ({ background: `color-mix(in srgb, ${tint} ${amount}%, transparent)` });

function highlight(body: string, entries: TrailEntry[], mark: CSSProperties): ReactNode[] {
  const spans = entries.flatMap(e => { const s = findInText(body, e.evidence_quote); return s ? [s] : []; })
    .sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  const rest = (from: number, to: number) => { if (to > from) out.push(<em key={`r${from}`}>{body.slice(from, to)}</em>); };
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue; // overlapping quote: the earlier one is already shown
    rest(pos, s.start);
    out.push(<span key={s.start} className="rounded-sm px-0.5" style={mark}>{body.slice(s.start, s.end)}</span>);
    pos = s.end;
  }
  rest(pos, body.length);
  return out;
}

/** The quote, with a toggle to see the whole entry it came from. `sameTree` is every entry on this tree. */
function Evidence({ entry, sameTree, mark }: { entry: TrailEntry; sameTree: TrailEntry[]; mark: CSSProperties }) {
  const [full, setFull] = useState(false);
  return (
    <blockquote className="m-0 font-display text-quote">
      {full
        ? <span className="whitespace-pre-wrap italic">&ldquo;{highlight(entry.journal_body.trim(), sameTree.filter(e => e.journal_id === entry.journal_id), mark)}&rdquo;</span>
        : <span className="rounded-sm px-[.15em] italic [box-decoration-break:clone]" style={mark}>&ldquo;{entry.evidence_quote}&rdquo;</span>}{" "}
      <button type="button" onClick={() => setFull(f => !f)} aria-expanded={full}
        aria-label={full ? "Collapse to just the quote" : "Expand to the full journal entry"}
        className="cursor-pointer border-0 bg-transparent p-0 font-body text-xs font-bold text-moss underline underline-offset-2 hover:text-ink">
        {full ? "Collapse" : "Expand"}
      </button>
    </blockquote>
  );
}

type State = { status: "loading" } | { status: "ready"; trail: TrailData } | { status: "error"; message: string };

/** `focusItemId`: scroll to this leaf or knot once loaded (opened from a leaf's pop-up). */
export default function ProgressDrawer({ pillar, focusItemId, onClose }: { pillar: GrovePillar; focusItemId?: string | null; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const color = pillarColor(pillar.position);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    getTrail(pillar.id)
      .then(trail => live && setState({ status: "ready", trail }))
      .catch(e => live && setState({ status: "error", message: e instanceof RequestError && e.status === 404 ? "This tree couldn't be found." : "Couldn't load this right now." }));
    return () => { live = false; };
  }, [pillar.id, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const entries = state.status === "ready" ? state.trail.entries : [];
  const blooms = entries.filter(e => e.kind === "bloom");
  const flash = useJumpTo(focusItemId && `trail-${focusItemId}`, state.status === "ready");
  const friction = state.status === "ready" && pillar.has_knot ? state.trail.entries.find(e => e.kind === "friction") : undefined;

  return (
    // A side panel, not a modal: the Grove stays usable beside it (GroveCanvas makes room on wide screens)
    <aside aria-labelledby="progress-title"
      className="paper-page animate-drawer fixed top-0 right-0 bottom-0 z-40 flex w-[min(440px,100%)] flex-col text-ink">
      <header className="relative px-12 pt-7 pb-2 text-center">
        <h2 id="progress-title" className="m-0 font-heading text-title">Growth in {pillar.name}</h2>
        {pillar.description && <p className="mx-auto mt-1 mb-0 max-w-[34ch] text-sm text-ink-soft">{pillar.description}</p>}
        {state.status === "ready" && (blooms.length > 0 || friction) && (
          <p className="mt-1 mb-0 font-display text-ink-soft italic">
            {blooms.length === 0 ? "No leaves yet" : `${blooms.length} ${blooms.length === 1 ? "leaf" : "leaves"}, newest first`}
          </p>
        )}
        <Fleuron className="mx-auto mt-3" />
        <button type="button" onClick={onClose} aria-label="Close" autoFocus
          className="absolute top-4 right-4 grid size-10 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink"><CloseIcon /></button>
      </header>

      <div className="flex-1 overflow-y-auto px-7 pt-4 pb-10">
        {state.status === "loading" && <p className="m-0 py-8 text-center text-ink-soft" role="status">Loading your progress…</p>}
        {state.status === "error" && (
          <div role="alert" className="py-8 text-center">
            <p className="mt-0 text-berry">{state.message}</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)}
              className="cursor-pointer rounded-full border-[1.5px] border-moss px-4 py-2 font-bold text-moss hover:bg-moss/10">Try again</button>
          </div>
        )}

        {state.status === "ready" && (blooms.length === 0 ? friction ? null : (
          <p className="py-8 text-center text-ink-soft">
            Nothing here yet. When you write about something you did for {pillar.name} and confirm it, it grows here as a leaf.
          </p>
        ) : (
          <>
            {/* The same stitched binding as the journal, in this tree's colour, each leaf pressed onto the page */}
            <ol className="m-0 list-none border-l-[1.5px] border-dashed py-0 pr-0 pl-5" style={{ borderColor: color }}>
              {blooms.map(e => (
                <li key={e.item_id} id={`trail-${e.item_id}`} className="relative pb-7">
                  <LeafMark color={color} className="absolute top-0.5 -left-[1.75rem]" />
                  <time dateTime={e.date} className={`${jumpDate(flash === `trail-${e.item_id}`)} font-label tracking-[.03em]`}>{formatDay(e.date)}</time>
                  <p className="mt-1 mb-1.5 font-bold">{e.interpretation}</p>
                  <Evidence entry={e} sameTree={entries} mark={markStyle(color, 35)} />
                </li>
              ))}
            </ol>
          </>
        ))}

        {friction && (
          <>
            <p className="mt-1 mb-3 font-label text-sm font-bold text-ink-soft">A recent knot</p>
            <ol className="m-0 list-none border-l-[1.5px] border-dashed border-[#C9A04A] py-0 pr-0 pl-5">
              <li id={`trail-${friction.item_id}`} className="relative pb-7">
                <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-3 rounded-full border border-[#6B4E3A] bg-[#C9A04A]" />
                <time dateTime={friction.date} className={`${jumpDate(flash === `trail-${friction.item_id}`)} font-label tracking-[.03em]`}>{formatDay(friction.date)}</time>
                <p className="mt-1 mb-1.5 font-bold">{friction.interpretation}</p>
                <Evidence entry={friction} sameTree={entries} mark={markStyle("#6B4E3A", 25)} />
              </li>
            </ol>
          </>
        )}
        {state.status === "ready" && (blooms.length > 0 || friction) && <Fleuron className="mx-auto mt-2 opacity-80" />}
      </div>
    </aside>
  );
}
