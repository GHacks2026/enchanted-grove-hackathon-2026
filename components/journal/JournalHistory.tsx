"use client";

// Every past journal entry (GET /api/journals, CONTRACT §8), newest first, in a side panel beside
// the Grove. Each entry shows the user's own words with that day's quotes highlighted; clicking a
// highlight shows what it grew and where. Read-only, confirmed entries only.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getJournals } from "@/lib/client";
import type { GrovePillar, JournalEntry } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { findInText } from "@/lib/findInText";
import { jumpDate, useJumpTo } from "@/components/useJumpTo";
import CloseIcon from "@/components/CloseIcon";
import Fleuron from "@/components/Fleuron";
import TornSheet from "./TornSheet";
import LeafMark from "@/components/tree/LeafMark";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

type State = { status: "loading" } | { status: "ready"; entries: JournalEntry[] } | { status: "error" };

/** The entry text with each quote highlighted; a highlight is a button that shows its item. */
function highlighted(entry: JournalEntry, selected: number | null, onSelect: (index: number) => void, treeColor: (pillarId: string | null) => string | null): ReactNode[] {
  const spans = entry.items.flatMap((item, index) => { const at = findInText(entry.body, item.evidence_quote); return at ? [{ ...at, kind: item.kind, index }] : []; })
    .sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    out.push(entry.body.slice(pos, s.start));
    const on = selected === s.index;
    // A leaf's highlight takes its tree's colour; knots are bark brown
    const color = s.kind === "bloom" ? treeColor(entry.items[s.index].pillar_id) : null;
    out.push(
      <mark key={s.start} role="button" tabIndex={0} aria-pressed={on}
        style={color ? ({ "--tree": color } as CSSProperties) : undefined}
        onClick={() => onSelect(s.index)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.index); } }}
        className={`cursor-pointer rounded-sm px-0.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-amber ${color
          ? `${on ? "bg-[color-mix(in_srgb,var(--tree)_65%,transparent)]" : "bg-[color-mix(in_srgb,var(--tree)_35%,transparent)]"} hover:bg-[color-mix(in_srgb,var(--tree)_55%,transparent)]`
          : s.kind === "bloom"
            ? `${on ? "bg-lichen/70" : "bg-lichen/40"} hover:bg-lichen/60`
            : `${on ? "bg-[#6B4E3A]/45" : "bg-[#6B4E3A]/25"} hover:bg-[#6B4E3A]/35`}`}>
        {entry.body.slice(s.start, s.end)}
      </mark>,
    );
    pos = s.end;
  }
  out.push(entry.body.slice(pos));
  return out;
}

function Entry({ entry, pillarById, openQuote, marked }: {
  entry: JournalEntry; pillarById: Map<string, GrovePillar>;
  openQuote?: string; // show this quote's item from the start (opened from a leaf's pop-up)
  marked: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(() => {
    const i = openQuote ? entry.items.findIndex(item => item.evidence_quote === openQuote) : -1;
    return i >= 0 ? i : null;
  });
  const [showLantern, setShowLantern] = useState(false);
  const item = selected === null ? null : entry.items[selected];
  const p = item?.pillar_id ? pillarById.get(item.pillar_id) : undefined;
  return (
    <li id={`journal-${entry.journal_id}`} className="relative pb-7">
      <LeafMark color="var(--color-lichen)" className="absolute top-0.5 -left-[1.75rem]" />
      <time dateTime={entry.date} className={`${jumpDate(marked)} font-label tracking-[.03em]`}>{formatDay(entry.date)}</time>
      {/* Set like a page of a book: plain prose on the paper */}
      <p className="mt-1.5 mb-2 font-display text-quote whitespace-pre-wrap">
        {highlighted(entry, selected, i => setSelected(cur => (cur === i ? null : i)), id => {
          const tree = id ? pillarById.get(id) : undefined;
          return tree ? pillarColor(tree.position) : null;
        })}
      </p>
      {item && (
        <p className="m-0 flex items-baseline gap-2 text-sm text-ink-soft" aria-live="polite">
          {item.kind === "bloom"
            ? <LeafMark color={p ? pillarColor(p.position) : "var(--color-lichen)"} size={11} className="translate-y-[1px]" />
            : <span aria-hidden className="size-2 flex-none translate-y-[-1px] rounded-full bg-[#6B4E3A]" />}
          <span>
            {item.kind === "bloom" ? "Leaf" : "Knot"}{p ? ` on ${p.name}` : ""}: <span className="text-ink">{item.interpretation}</span>
          </span>
        </p>
      )}
      {/* The small next step Sprout suggested after this entry */}
      <button type="button" onClick={() => setShowLantern(v => !v)} aria-expanded={showLantern}
        className="mt-1 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-bold text-moss hover:text-ink">
        <svg aria-hidden viewBox="0 0 12 16" width="10" height="13" className="flex-none">
          <path d="M6 .6v1.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="3" y="2.4" width="6" height="1.6" rx=".6" fill="currentColor" />
          <rect x="2.4" y="4.2" width="7.2" height="8.2" rx="2.4" fill="#E9B44C" stroke="currentColor" strokeWidth="1" />
          <rect x="3.5" y="12.6" width="5" height="1.6" rx=".6" fill="currentColor" />
        </svg>
        {showLantern ? "Hide Lantern" : "See Lantern"}
      </button>
      {showLantern && (
        <div className="mt-1.5 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm">
          <p className="m-0 font-label text-sm font-bold text-[#8A6414]">Lantern</p>
          <p className="mt-0.5 mb-0">{entry.lantern}</p>
        </div>
      )}
    </li>
  );
}

/** `focus`: scroll to this entry once loaded and show the quote's item (opened from a leaf's pop-up). */
export default function JournalHistory({ pillars, focus, onClose }: {
  pillars: GrovePillar[]; focus?: { journalId: string; quote: string } | null; onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    getJournals().then(entries => live && setState({ status: "ready", entries })).catch(() => live && setState({ status: "error" }));
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pillarById = new Map(pillars.map(p => [p.id, p]));
  const flash = useJumpTo(focus && `journal-${focus.journalId}`, state.status === "ready");

  return (
    <TornSheet aria-labelledby="journal-history-title" className="flex flex-col">
      <header className="relative px-3 pt-6 pb-2 text-center">
        <h2 id="journal-history-title" className="m-0 font-heading text-title">Your journal</h2>
        {state.status === "ready" && state.entries.length > 0 && (
          <p className="mt-1 mb-0 font-display text-ink-soft italic">
            {state.entries.length} {state.entries.length === 1 ? "entry" : "entries"}, newest first
          </p>
        )}
        <Fleuron className="mx-auto mt-3" />
        <button type="button" onClick={onClose} aria-label="Close" autoFocus
          className="absolute top-3 right-1 grid size-10 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink"><CloseIcon /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8 [scrollbar-color:var(--color-page-edge)_transparent] [scrollbar-width:thin]">
        {state.status === "loading" && <p className="m-0 py-8 text-center text-ink-soft" role="status">Loading your entries…</p>}
        {state.status === "error" && (
          <div role="alert" className="py-8 text-center">
            <p className="mt-0 text-berry">Couldn&apos;t load your journal right now.</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)}
              className="cursor-pointer rounded-full border-[1.5px] border-moss px-4 py-2 font-bold text-moss hover:bg-moss/10">Try again</button>
          </div>
        )}
        {state.status === "ready" && (state.entries.length === 0 ? (
          <p className="py-8 text-center text-ink-soft">No entries yet. Reflect on your day and your entries will gather here.</p>
        ) : (
          <>
            {/* The timeline as a stitched binding down the page, each entry a pressed leaf */}
            <ol className="m-0 list-none border-l-[1.5px] border-dashed border-[#B4BD9E] py-0 pr-0 pl-5">
              {state.entries.map(entry => (
                <Entry key={entry.journal_id} entry={entry} pillarById={pillarById} marked={flash === `journal-${entry.journal_id}`}
                  openQuote={focus?.journalId === entry.journal_id ? focus.quote : undefined} />
              ))}
            </ol>
            <Fleuron className="mx-auto mt-2 opacity-80" />
          </>
        ))}
      </div>
    </TornSheet>
  );
}
