"use client";

// A tree's progress (issue #3, Evidence Trail): every leaf on the tree, newest first,
// with the date, what it means, and the user's own words. Read-only (CONTRACT §8, §9).
import { useEffect, useState } from "react";
import { getTrail, RequestError } from "@/lib/client";
import type { GrovePillar, TrailData } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

type State = { status: "loading" } | { status: "ready"; trail: TrailData } | { status: "error"; message: string };

export default function ProgressDrawer({ pillar, onClose }: { pillar: GrovePillar; onClose: () => void }) {
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

  const blooms = state.status === "ready" ? state.trail.entries.filter(e => e.kind === "bloom") : [];
  const friction = state.status === "ready" && pillar.has_knot ? state.trail.entries.find(e => e.kind === "friction") : undefined;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-[rgba(20,18,40,.45)]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="progress-title"
        className="animate-drawer absolute top-0 right-0 bottom-0 flex w-[min(440px,100%)] flex-col bg-panel text-ink shadow-[-20px_0_50px_-20px_rgba(10,8,30,.55)]">
        <header className="flex items-start gap-3 border-b border-line px-5 pt-5 pb-4" style={{ borderTop: `5px solid ${color}` }}>
          <div className="flex-1">
            <h2 id="progress-title" className="m-0 font-display text-3xl leading-tight font-normal">Your progress in {pillar.name}</h2>
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

          {friction && (
            <section className="mb-5 rounded-2xl border border-[#E5D2A8] bg-[#F7EEDB] px-4 py-3">
              <p className="m-0 text-sm font-bold text-[#6E4E12]">Recently harder</p>
              <p className="mt-1 mb-2">{friction.interpretation}</p>
              <blockquote className="m-0 border-l-3 border-[#C9A04A] bg-amber/15 px-3 py-2 font-display">&ldquo;{friction.evidence_quote}&rdquo;</blockquote>
            </section>
          )}

          {state.status === "ready" && (blooms.length === 0 ? (
            <p className="py-8 text-center text-ink-soft">
              Nothing here yet. When you write about something you did for {pillar.name} and confirm it, it grows here as a leaf.
            </p>
          ) : (
            <>
              <p className="mt-0 mb-4 text-sm text-ink-soft">
                {blooms.length} {blooms.length === 1 ? "leaf" : "leaves"}, newest first. Each one is something you did, in your own words.
              </p>
              <ol className="m-0 list-none border-l-2 py-0 pr-0 pl-5" style={{ borderColor: color }}>
                {blooms.map(e => (
                  <li key={e.item_id} className="relative pb-5">
                    <span aria-hidden className="absolute top-1 -left-[1.62rem] size-3 -rotate-45 rounded-[50%_0]" style={{ background: color }} />
                    <time dateTime={e.date} className="text-sm font-bold text-ink-soft">{formatDay(e.date)}</time>
                    <p className="mt-0.5 mb-1.5 font-bold">{e.interpretation}</p>
                    <blockquote className="m-0 border-l-3 border-lichen bg-lichen/15 px-3 py-2 font-display">&ldquo;{e.evidence_quote}&rdquo;</blockquote>
                  </li>
                ))}
              </ol>
            </>
          ))}
        </div>
      </aside>
    </div>
  );
}
