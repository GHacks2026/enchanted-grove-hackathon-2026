"use client";

// A tree's progress (issue #3, Evidence Trail): every leaf on the tree, newest first,
// with the date, what it means, and the user's own words. Read-only (CONTRACT §8, §9).
// Each quote can expand to the full journal entry: this tree's quotes stay upright, the rest is italic.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTrail, RequestError } from "@/lib/client";
import type { GrovePillar, TrailData, TrailEntry } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { findInText } from "@/lib/findInText";
import { jumpDate, useJumpTo } from "@/components/useJumpTo";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function highlight(body: string, entries: TrailEntry[]): ReactNode[] {
  const spans = entries.flatMap(e => { const s = findInText(body, e.evidence_quote); return s ? [s] : []; })
    .sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  const rest = (from: number, to: number) => { if (to > from) out.push(<em key={`r${from}`}>{body.slice(from, to)}</em>); };
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue; // overlapping quote: the earlier one is already shown
    rest(pos, s.start);
    out.push(<span key={s.start}>{body.slice(s.start, s.end)}</span>);
    pos = s.end;
  }
  rest(pos, body.length);
  return out;
}

/** The quote, with a toggle to see the whole entry it came from. `sameTree` is every entry on this tree. */
function Evidence({ entry, sameTree, className }: { entry: TrailEntry; sameTree: TrailEntry[]; className: string }) {
  const [full, setFull] = useState(false);
  return (
    <blockquote className={`m-0 px-3 py-1.5 font-display text-sm ${className}`}>
      {full
        ? <span className="whitespace-pre-wrap">&ldquo;{highlight(entry.journal_body.trim(), sameTree.filter(e => e.journal_id === entry.journal_id))}&rdquo;</span>
        : <>&ldquo;{entry.evidence_quote}&rdquo;</>}{" "}
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
      className="animate-drawer fixed top-0 right-0 bottom-0 z-40 flex w-[min(440px,100%)] flex-col bg-panel text-ink shadow-[-20px_0_50px_-20px_rgba(10,8,30,.55)]">
      <header className="flex items-start gap-3 border-b border-line px-5 pt-5 pb-4">
        <div className="flex-1">
          <h2 id="progress-title" className="m-0 font-display text-3xl leading-tight font-normal">Growth in {pillar.name}</h2>
          {pillar.description && <p className="mt-1 mb-0 text-sm text-ink-soft">{pillar.description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" autoFocus
          className="grid size-10 flex-none cursor-pointer place-items-center rounded-lg text-3xl leading-none text-ink-soft hover:bg-ink/10 hover:text-ink">×</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
        {state.status === "loading" && <p className="m-0 py-8 text-center text-ink-soft" role="status">Loading your progress…</p>}
        {state.status === "error" && (
          <div role="alert" className="py-8 text-center">
            <p className="mt-0 text-berry">{state.message}</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)}
              className="cursor-pointer rounded-full border-[1.5px] border-moss px-4 py-2 font-bold text-moss hover:bg-moss/10">Try again</button>
          </div>
        )}

        {state.status === "ready" && (blooms.length === 0 ? friction ? (
          // A knot but no leaves yet: keep it short, in the same style as the leaf count
          <p className="mt-0 mb-4 text-sm text-ink-soft">No leaves yet</p>
        ) : (
          <p className="py-8 text-center text-ink-soft">
            Nothing here yet. When you write about something you did for {pillar.name} and confirm it, it grows here as a leaf.
          </p>
        ) : (
          <>
            <p className="mt-0 mb-4 text-sm text-ink-soft">
              {blooms.length} {blooms.length === 1 ? "leaf" : "leaves"}
            </p>
            <ol className="m-0 list-none border-l-2 py-0 pr-0 pl-5" style={{ borderColor: color }}>
              {blooms.map(e => (
                <li key={e.item_id} id={`trail-${e.item_id}`} className="relative pb-5">
                  <span aria-hidden className="absolute top-1 -left-[1.62rem] size-3 -rotate-45 rounded-[50%_0]" style={{ background: color }} />
                  <time dateTime={e.date} className={jumpDate(flash === `trail-${e.item_id}`)}>{formatDay(e.date)}</time>
                  <p className="mt-0.5 mb-1.5 font-bold">{e.interpretation}</p>
                  <Evidence entry={e} sameTree={entries} className="bg-lichen/15" />
                </li>
              ))}
            </ol>
          </>
        ))}

        {friction && (
          <>
            <p className="mt-2 mb-4 text-sm text-ink-soft">A recent knot</p>
            <ol className="m-0 list-none border-l-2 border-[#C9A04A] py-0 pr-0 pl-5">
              <li id={`trail-${friction.item_id}`} className="relative pb-5">
                <span aria-hidden className="absolute top-1 -left-[1.62rem] size-3 rounded-full bg-[#C9A04A]" />
                <time dateTime={friction.date} className={jumpDate(flash === `trail-${friction.item_id}`)}>{formatDay(friction.date)}</time>
                <p className="mt-0.5 mb-1.5 font-bold">{friction.interpretation}</p>
                <Evidence entry={friction} sameTree={entries} className="bg-amber/15" />
              </li>
            </ol>
          </>
        )}
      </div>
    </aside>
  );
}
