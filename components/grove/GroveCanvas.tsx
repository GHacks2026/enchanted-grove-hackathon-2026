"use client";

// The Grove home view (issue #2): one tree per Pillar, pan and zoom,
// tap a leaf or knot to see the user's own words, Lantern, and the journal button.
// GET /api/grove only sends leaf_count and has_knot, so evidence loads from
// GET /api/pillars/:id/trail when a leaf or knot is tapped (CONTRACT §8).
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getTrail } from "@/lib/client";
import type { GroveData, GrovePillar, TrailData, TrailEntry } from "@/lib/client";
import PillarTree from "@/components/tree/PillarTree";
import { pillarColor } from "@/components/tree/colors";
import { layoutGrove } from "./groveLayout";
import { useCamera } from "./useCamera";
import { Fireflies, Sky } from "./Atmosphere";
import LanternPost from "./LanternPost";
import ProgressDrawer from "@/components/trail/ProgressDrawer";
import { GROUND_Y } from "@/components/tree/treeModel";

type Selection = { kind: "leaf" | "knot"; pillar: GrovePillar; index: number; anchor: Element };
type Evidence = { status: "loading" } | { status: "ready"; entry: TrailEntry | null } | { status: "error"; message: string };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** Leaf n (oldest first) matches the nth bloom in the trail (which is newest first). Knot = newest friction. */
function pickEntry(trail: TrailData, sel: Selection): TrailEntry | null {
  if (sel.kind === "knot") return trail.entries.find(e => e.kind === "friction") ?? null;
  const oldestFirst = trail.entries.filter(e => e.kind === "bloom").reverse();
  return oldestFirst[sel.index] ?? null;
}

interface Props { data: GroveData }

export default function GroveCanvas({ data }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const { camera, flyTo, zoomBy, wasDrag, handlers } = useCamera(viewportRef);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const trails = useRef(new Map<string, TrailData>());
  const [trailPillar, setTrailPillar] = useState<GrovePillar | null>(null);
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  const [showTip, setShowTip] = useState(false);

  // Newly grown leaves get a moment in the spotlight. The review screen leaves a note in
  // sessionStorage after confirming; ?preview=new-leaves shows the effect without one.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("preview") === "new-leaves") {
        setNewCounts(Object.fromEntries(data.pillars.filter(p => p.leaf_count > 0).map(p => [p.id, 1])));
      } else {
        const note = sessionStorage.getItem("sprout:new-leaves");
        if (note) { setNewCounts(JSON.parse(note)); sessionStorage.removeItem("sprout:new-leaves"); }
      }
      setShowTip(!localStorage.getItem("sprout:tip-seen"));
    } catch { /* storage blocked: skip the extras */ }
  }, [data.pillars]);
  const dismissTip = () => { setShowTip(false); try { localStorage.setItem("sprout:tip-seen", "1"); } catch { /* ignore */ } };
  const openTrail = (p: GrovePillar) => { close(); dismissTip(); setTrailPillar(p); };

  const pillars = useMemo(() => [...data.pillars].sort((a, b) => a.position - b.position), [data.pillars]);

  // The header and bottom buttons sit over the canvas, so trees are laid out in the space between.
  const top = 96, bottom = size.w < 900 ? 250 : 100;
  const layout = useMemo(() => layoutGrove(pillars, size.w, size.h - top - bottom), [pillars, size, bottom]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => setSize({ w: vp.clientWidth, h: vp.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback((animate = true) => {
    const b = layout.bounds;
    flyTo({ x: b.x, y: b.y - top, w: b.w, h: b.h + top + bottom }, { padding: 30, maxZoom: 1.3, animate });
  }, [flyTo, layout.bounds, bottom]);
  useLayoutEffect(() => { fit(false); }, [fit, size.w, size.h]);
  useEffect(() => { setSelection(null); setEvidence(null); }, [size.w, size.h]); // trees move on resize

  async function select(sel: Selection) {
    dismissTip();
    setSelection(sel);
    const cached = trails.current.get(sel.pillar.id);
    if (cached) { setEvidence({ status: "ready", entry: pickEntry(cached, sel) }); return; }
    setEvidence({ status: "loading" });
    try {
      const trail = await getTrail(sel.pillar.id);
      trails.current.set(sel.pillar.id, trail);
      setEvidence({ status: "ready", entry: pickEntry(trail, sel) });
    } catch {
      setEvidence({ status: "error", message: "Couldn't load this right now. Tap the leaf to try again." });
    }
  }
  const close = () => { setSelection(null); setEvidence(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Place the popover beside the tapped leaf or knot when there's room, so the tree stays visible.
  const pop = (() => {
    if (!selection || !shellRef.current) return null;
    const r = selection.anchor.getBoundingClientRect();
    const s = shellRef.current.getBoundingClientRect();
    const W = Math.min(320, s.width - 24), H = 240;
    const y = Math.min(Math.max(r.top - s.top - 60, 80), s.height - H - 20);
    if (r.right - s.left + 16 + W < s.width - 12) return { left: r.right - s.left + 16, top: y };
    if (r.left - s.left - 16 - W > 12) return { left: r.left - s.left - 16 - W, top: y };
    return { left: Math.min(Math.max(r.left + r.width / 2 - s.left - W / 2, 12), s.width - W - 12), top: r.bottom - s.top + 12 };
  })();

  const noLeaves = pillars.every(p => p.leaf_count === 0);

  return (
    <div ref={shellRef} className="bg-grove relative h-dvh overflow-hidden text-sky">
      <Sky />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-dusk-deep/85 to-transparent px-6 pt-5 pb-10">
        <p className="m-0 text-sm text-sky-soft">Your Grove</p>
        <h1 className="m-0 max-w-[34ch] font-display text-2xl leading-tight font-normal md:text-4xl">{data.grove.goal}</h1>
      </header>

      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden outline-none active:cursor-grabbing focus-visible:shadow-[inset_0_0_0_3px_var(--color-amber)]"
        tabIndex={0}
        role="region"
        aria-label="Your Grove. Drag to look around, scroll or pinch to zoom."
        {...handlers}
        onClick={e => { if (!wasDrag() && !(e.target as Element).closest("[role=button], button, a")) close(); }}
      >
        <div className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}>
          {/* A shared meadow under each row, so the trees stand on land rather than floating */}
          {Object.values(layout.slots.reduce<Record<number, { x0: number; x1: number; y: number }>>((rows, s) => {
            const key = Math.round(s.y / 100);
            const r = rows[key] ?? { x0: s.x, x1: s.x + 260, y: s.y };
            rows[key] = { x0: Math.min(r.x0, s.x), x1: Math.max(r.x1, s.x + 260), y: Math.max(r.y, s.y) };
            return rows;
          }, {})).map((r, i) => (
            <div key={i} aria-hidden className="pointer-events-none absolute rounded-[50%] bg-[radial-gradient(closest-side,#36502C_60%,rgba(54,80,44,0))]"
              style={{ left: r.x0 - 90, top: r.y + GROUND_Y - 22, width: r.x1 - r.x0 + 180, height: 70 }} />
          ))}
          {layout.slots.map(({ pillar, x, y }) => (
            <div key={pillar.id} className="absolute w-[260px]" style={{ left: x, top: y }}>
              <PillarTree
                pillar={pillar}
                selectedLeaf={selection?.kind === "leaf" && selection.pillar.id === pillar.id ? selection.index : null}
                knotSelected={selection?.kind === "knot" && selection.pillar.id === pillar.id}
                onLeafSelect={(index, anchor) => select({ kind: "leaf", pillar, index, anchor })}
                onKnotSelect={anchor => select({ kind: "knot", pillar, index: 0, anchor })}
                newCount={newCounts[pillar.id] ?? 0}
                onOpenTrail={() => openTrail(pillar)}
              />
            </div>
          ))}
        </div>

        {noLeaves && (
          <p className="pointer-events-none absolute top-[22%] left-1/2 z-[2] m-0 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 text-center text-sky-soft">
            Your trees are seedlings. Each thing you do toward your goal becomes a leaf once you confirm it.
          </p>
        )}
      </div>

      <Fireflies />

      {selection && pop && (
        <div role="dialog" aria-label={selection.kind === "leaf" ? "What this leaf is" : "Recent friction"}
          className="absolute z-20 w-[min(320px,calc(100%-1.5rem))] rounded-2xl border-t-4 bg-panel px-4 pt-3.5 pb-3 text-ink shadow-[0_18px_40px_-16px_rgba(10,8,30,.7)]"
          style={{ left: pop.left, top: pop.top, borderTopColor: pillarColor(selection.pillar.position) }}>
          <button type="button" onClick={close} aria-label="Close"
            className="absolute top-1.5 right-1.5 grid size-8 cursor-pointer place-items-center rounded-lg text-xl text-ink-soft hover:bg-ink/10">×</button>
          {evidence?.status === "loading" && <p className="m-0 py-4 text-sm text-ink-soft">Loading the evidence…</p>}
          {evidence?.status === "error" && <p className="m-0 py-2 pr-6 text-sm text-berry">{evidence.message}</p>}
          {evidence?.status === "ready" && (evidence.entry ? (
            <>
              <p className="m-0 text-xs text-ink-soft">
                {selection.pillar.name}, {selection.kind === "knot" ? "recently harder" : formatDate(evidence.entry.date)}
              </p>
              <p className="mt-1 mr-6 mb-2 font-bold">{evidence.entry.interpretation}</p>
              <blockquote className={`m-0 border-l-3 px-3 py-2 font-display text-[1.02rem] leading-snug ${selection.kind === "knot" ? "border-[#C9A04A] bg-amber/15" : "border-lichen bg-lichen/15"}`}>
                &ldquo;{evidence.entry.evidence_quote}&rdquo;
              </blockquote>
              <p className="mt-1.5 mb-0 text-xs text-ink-soft">
                {selection.kind === "knot" ? "Something recently made this area harder." : "Your words, from that day's entry."}
              </p>
              <button type="button" onClick={() => openTrail(selection.pillar)}
                className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-moss underline underline-offset-2 hover:text-ink">
                See all progress in {selection.pillar.name}
              </button>
            </>
          ) : (
            <p className="m-0 py-2 pr-6 text-sm text-ink-soft">We couldn&apos;t find the words for this leaf.</p>
          ))}
        </div>
      )}

      {/* Tomorrow's Lantern: a lantern on a post, with its next step written in the card beside it */}
      <aside aria-label="Tomorrow's Lantern"
        className="absolute bottom-[calc(1.2rem+env(safe-area-inset-bottom))] left-4 z-10 flex w-[min(400px,calc(100%-2rem))] items-end gap-1 max-[900px]:right-3 max-[900px]:bottom-[calc(5.4rem+env(safe-area-inset-bottom))] max-[900px]:left-3 max-[900px]:w-auto">
        <LanternPost lit={!!data.lantern} />
        <div className="mb-2 rounded-2xl border border-amber/35 bg-dusk-deep/90 px-4 py-3 backdrop-blur">
          {data.lantern ? (
            <>
              <p className="m-0 text-xs font-bold text-amber">Tomorrow&apos;s Lantern</p>
              <p className="mt-0.5 mb-0">{data.lantern}</p>
            </>
          ) : (
            <p className="m-0 text-sm text-sky-soft">Your Lantern lights up with a small next step after your first reflection.</p>
          )}
        </div>
      </aside>

      <div className="absolute bottom-[calc(1.4rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 max-[900px]:right-3 max-[900px]:left-3 max-[900px]:translate-x-0">
        <Link href="/reflect"
          className="block rounded-full bg-amber px-6 py-3.5 text-center font-bold text-[#2B2412] shadow-[0_14px_30px_-12px_rgba(10,8,30,.8)] hover:bg-[#F0C266] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky">
          Reflect on your day
        </Link>
      </div>

      {showTip && !trailPillar && (
        <div role="note" className="absolute top-[calc(6.2rem+env(safe-area-inset-top))] left-1/2 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber/40 bg-dusk-deep/90 py-2 pr-2 pl-4 text-sm text-sky backdrop-blur max-[900px]:top-[calc(8.4rem+env(safe-area-inset-top))]">
          <span>Tap a tree to see your progress, or a leaf for that one moment.</span>
          <button type="button" onClick={dismissTip} aria-label="Dismiss tip" className="grid size-7 cursor-pointer place-items-center rounded-full text-lg hover:bg-sky/15">×</button>
        </div>
      )}

      {trailPillar && <ProgressDrawer pillar={trailPillar} onClose={() => setTrailPillar(null)} />}

      <div role="toolbar" aria-label="Zoom"
        className="absolute right-4 bottom-[calc(1.4rem+env(safe-area-inset-bottom))] z-10 flex gap-0.5 rounded-full bg-dusk-deep/80 p-1 max-[900px]:top-[calc(5.2rem+env(safe-area-inset-top))] max-[900px]:right-3 max-[900px]:bottom-auto">
        {[
          { label: "−", aria: "Zoom out", act: () => zoomBy(0.8, undefined, undefined, true) },
          { label: "+", aria: "Zoom in", act: () => zoomBy(1.25, undefined, undefined, true) },
          { label: "Fit", aria: "Fit the whole Grove", act: () => fit() },
        ].map(b => (
          <button key={b.label} type="button" onClick={b.act} aria-label={b.aria}
            className="h-9 min-w-9 cursor-pointer rounded-full px-2.5 font-bold text-sky hover:bg-sky/10 focus-visible:outline-2 focus-visible:outline-amber">
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
