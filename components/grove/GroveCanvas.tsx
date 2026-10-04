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
import { layoutGrove } from "./groveLayout";
import { buildTree, GROUND_Y, LEAF_LENGTH, TREE_W } from "@/components/tree/treeModel";
import { MAX_ZOOM, MIN_ZOOM, useCamera } from "./useCamera";
import type { Camera } from "./useCamera";
import { Fireflies, Sky } from "./Atmosphere";
import LanternPost from "./LanternPost";
import ProgressDrawer from "@/components/trail/ProgressDrawer";
import JournalHistory from "@/components/journal/JournalHistory";
import LeafFlight from "./LeafFlight";
import { pillarColor } from "@/components/tree/colors";

type Selection = { kind: "leaf" | "knot"; pillar: GrovePillar; index: number; anchor: Element };
type Evidence = { status: "loading" } | { status: "ready"; entry: TrailEntry | null } | { status: "error"; message: string };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** Leaf n (oldest first) matches the nth bloom in the trail (which is newest first). Knot = newest friction. */
function pickEntry(trail: TrailData, sel: Selection): TrailEntry | null {
  if (sel.kind === "knot") return trail.entries.find(e => e.kind === "friction") ?? null;
  const oldestFirst = trail.entries.filter(e => e.kind === "bloom").reverse();
  return oldestFirst[sel.index] ?? null;
}

interface Props {
  data: GroveData;
  /** A side panel (the journal) is open on the right, so make room for it like the progress panel. */
  panelOpen?: boolean;
}

export default function GroveCanvas({ data, panelOpen = false }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lanternRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const trails = useRef(new Map<string, TrailData>());
  const [trailPillar, setTrailPillar] = useState<GrovePillar | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Where to jump in a panel when it's opened from a leaf's pop-up
  const [trailFocus, setTrailFocus] = useState<string | null>(null);
  const [historyFocus, setHistoryFocus] = useState<{ journalId: string; quote: string } | null>(null);
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  // New leaves still flying in, per tree (not drawn until they land), the queue, and the one in the air
  const [inFlight, setInFlight] = useState<Record<string, number>>({});
  const flightQueue = useRef<{ pillarId: string; from: { x: number; y: number } | null }[]>([]);
  const [flight, setFlight] = useState<{ pillarId: string; from: { x: number; y: number }; to: { x: number; y: number }; angle: number; length: number; color: string } | null>(null);
  const [showTip, setShowTip] = useState(false);

  // Newly grown leaves fly in from the review, one at a time (LeafFlight). The review screen leaves
  // a note in sessionStorage after confirming; ?preview=new-leaves plays it without one.
  // A layout effect, so new leaves are hidden before the first paint rather than flickering.
  useLayoutEffect(() => {
    let leaves: { pillarId: string; from: { x: number; y: number } | null }[] = [];
    try {
      if (new URLSearchParams(window.location.search).get("preview") === "new-leaves") {
        leaves = data.pillars.filter(p => p.leaf_count > 0).map(p => ({ pillarId: p.id, from: null }));
      } else {
        const note = sessionStorage.getItem("sprout:new-leaves");
        if (note) { leaves = JSON.parse(note).leaves ?? []; sessionStorage.removeItem("sprout:new-leaves"); }
      }
      setShowTip(!localStorage.getItem("sprout:tip-seen"));
    } catch { /* storage blocked: skip the extras */ }
    leaves = leaves.filter(l => data.pillars.some(p => p.id === l.pillarId));
    if (!leaves.length) return;
    const counts: Record<string, number> = {};
    for (const l of leaves) counts[l.pillarId] = (counts[l.pillarId] ?? 0) + 1;
    setNewCounts(counts);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // just show them
    setInFlight(counts);
    flightQueue.current = leaves;
    const t = setTimeout(() => launchNext.current(), 700); // let the Grove settle after the panel closes
    return () => clearTimeout(t);
  }, [data.pillars]);
  const dismissTip = () => { setShowTip(false); try { localStorage.setItem("sprout:tip-seen", "1"); } catch { /* ignore */ } };
  const openTrail = (p: GrovePillar, itemId: string | null = null) => { close(); dismissTip(); setHistoryOpen(false); setTrailFocus(itemId); setTrailPillar(p); };
  const openHistory = (focus: { journalId: string; quote: string } | null = null) => { close(); setTrailPillar(null); setHistoryFocus(focus); setHistoryOpen(true); };

  const pillars = useMemo(() => [...data.pillars].sort((a, b) => a.position - b.position), [data.pillars]);

  // The header sits over the top of the canvas. The trees stand on a ground line just above
  // the Lantern and stay pinned there: panning only moves them sideways, zoom grows them upward.
  const top = 96;
  const [bottom, setBottom] = useState(250);
  const groundY = size.h - bottom;
  const layout = useMemo(() => layoutGrove(pillars, size.w, groundY - top), [pillars, size.w, groundY]);
  const b = layout.bounds;
  const pinToGround = useCallback((c: Camera) => ({ ...c, y: groundY - (b.y + b.h) * c.k }), [groundY, b]);
  const { camera, animateTo, zoomBy, wasDrag, handlers } = useCamera(viewportRef, pinToGround);

  useLayoutEffect(() => {
    const vp = viewportRef.current, lantern = lanternRef.current;
    if (!vp || !lantern) return;
    const measure = () => {
      setSize({ w: vp.clientWidth, h: vp.clientHeight });
      // 36px clears the lantern, which is scaled up past the top of its box
      setBottom(vp.getBoundingClientRect().bottom - lantern.getBoundingClientRect().top + 36);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(lantern);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback((animate = true) => {
    const k = Math.max(MIN_ZOOM, Math.min((size.w - 60) / b.w, (groundY - top) / b.h, 1.3));
    animateTo({ k, x: size.w / 2 - (b.x + b.w / 2) * k, y: 0 }, animate ? 650 : 0); // y is set by pinToGround
  }, [animateTo, b, size.w, groundY]);
  useLayoutEffect(() => { fit(false); }, [fit]);

  // Tapping a tree zooms in on it, centred in the space beside its progress panel
  // (the panel is 440px wide, or the full screen when the window is narrower than that).
  const focus = useCallback((p: GrovePillar, animate = true) => {
    const slot = layout.slots.find(s => s.pillar.id === p.id);
    if (!slot) return;
    const availW = size.w > 440 ? size.w - 440 : size.w;
    // From the top of the tree itself (its highest leaf tip or twig) down to the ground line
    const tree = buildTree(p.id, p.leaf_count);
    const tipY = Math.min(GROUND_Y - tree.height, ...tree.leaves.map(l => l.y - LEAF_LENGTH * l.scale));
    const treeH = b.y + b.h - (slot.y + tipY) + 30;
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (groundY - top) / treeH, (availW - 60) / TREE_W));
    animateTo({ k, x: availW / 2 - (slot.x + TREE_W / 2) * k, y: 0 }, animate ? 650 : 0); // y is set by pinToGround
  }, [animateTo, layout.slots, b, size.w, groundY]);
  // Focus when the panel opens or switches trees (and again after a resize); zoom back out when it closes
  const hadTrail = useRef(false);
  useEffect(() => {
    if (trailPillar) focus(trailPillar);
    else if (hadTrail.current) fit();
    hadTrail.current = !!trailPillar;
  }, [trailPillar, focus, fit]);

  // Send the next queued leaf from its card to the spot it will take on its tree (the first one
  // not drawn yet), using where that spot is on screen right now.
  const launchNext = useRef(() => {});
  launchNext.current = () => {
    const next = flightQueue.current.shift();
    if (!next) return;
    const slot = layout.slots.find(s => s.pillar.id === next.pillarId);
    if (!slot) return launchNext.current();
    const p = slot.pillar;
    const leaf = buildTree(p.id, p.leaf_count).leaves[p.leaf_count - (inFlight[p.id] ?? 1)];
    if (!leaf) return launchNext.current();
    const rad = leaf.angle * Math.PI / 180, half = (LEAF_LENGTH / 2) * leaf.scale;
    const wx = slot.x + leaf.x + Math.cos(rad) * half, wy = slot.y + leaf.y + Math.sin(rad) * half;
    setFlight({
      pillarId: p.id,
      from: next.from ?? { x: window.innerWidth - 220, y: window.innerHeight * 0.45 },
      to: { x: camera.x + wx * camera.k, y: camera.y + wy * camera.k },
      angle: leaf.angle, length: LEAF_LENGTH * leaf.scale * camera.k, color: pillarColor(p.position),
    });
  };
  // Landed: draw the real leaf (it grows in), give the tree a little rustle, then send the next one
  const landed = useCallback((pillarId: string) => {
    setInFlight(f => ({ ...f, [pillarId]: Math.max(0, (f[pillarId] ?? 1) - 1) }));
    setFlight(null);
    document.getElementById(`tree-${pillarId}`)?.animate(
      [{ transform: "rotate(0)" }, { transform: "rotate(1.2deg)" }, { transform: "rotate(-0.8deg)" }, { transform: "rotate(0)" }],
      { duration: 700, easing: "ease-out" },
    );
    setTimeout(() => launchNext.current(), 350);
  }, []);
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
    if (!selection || !viewportRef.current) return null;
    const r = selection.anchor.getBoundingClientRect();
    const s = viewportRef.current.getBoundingClientRect();
    const W = Math.min(320, s.width - 24), H = 240;
    const y = Math.min(Math.max(r.top - s.top - 60, 80), s.height - H - 20);
    if (r.right - s.left + 16 + W < s.width - 12) return { left: r.right - s.left + 16, top: y };
    if (r.left - s.left - 16 - W > 12) return { left: r.left - s.left - 16 - W, top: y };
    return { left: Math.min(Math.max(r.left + r.width / 2 - s.left - W / 2, 12), s.width - W - 12), top: r.bottom - s.top + 12 };
  })();

  const noLeaves = pillars.every(p => p.leaf_count === 0);

  return (
    <div className="bg-grove relative h-dvh overflow-hidden text-sky">
      <Sky />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-dusk-deep/85 to-transparent px-6 pt-5 pb-10">
        <h1 className="m-0 max-w-[34ch] font-display text-2xl leading-tight font-normal md:text-4xl">{data.grove.goal}</h1>
      </header>
      <button type="button" onClick={() => openHistory()}
        className="absolute top-[calc(1.25rem+env(safe-area-inset-top))] right-5 z-10 cursor-pointer rounded-full border border-sky/30 bg-dusk-deep/80 px-4 py-2 text-sm font-bold text-sky backdrop-blur hover:bg-sky/15 focus-visible:outline-2 focus-visible:outline-amber">
        Your journal
      </button>

      <div
        ref={viewportRef}
        className={`absolute inset-0 ${panelOpen ? "min-[900px]:right-[440px]" : ""} cursor-grab touch-none overflow-hidden outline-none active:cursor-grabbing focus-visible:shadow-[inset_0_0_0_3px_var(--color-amber)]`}
        tabIndex={0}
        role="region"
        aria-label="Your Grove. Drag to look around, scroll or pinch to zoom."
        {...handlers}
        onClick={e => { if (!wasDrag() && !(e.target as Element).closest("[role=button], button, a")) close(); }}
      >
        <div className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}>
          {layout.slots.map(({ pillar, x, y }) => (
            <div key={pillar.id} id={`tree-${pillar.id}`} className="absolute w-[260px] origin-[50%_85%]" style={{ left: x, top: y }}>
              <PillarTree
                pillar={pillar}
                selectedLeaf={selection?.kind === "leaf" && selection.pillar.id === pillar.id ? selection.index : null}
                knotSelected={selection?.kind === "knot" && selection.pillar.id === pillar.id}
                onLeafSelect={(index, anchor) => select({ kind: "leaf", pillar, index, anchor })}
                onKnotSelect={anchor => select({ kind: "knot", pillar, index: 0, anchor })}
                newCount={newCounts[pillar.id] ?? 0}
                hiddenCount={inFlight[pillar.id] ?? 0}
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
          className="absolute z-20 w-[min(320px,calc(100%-1.5rem))] rounded-2xl bg-panel px-4 pt-3.5 pb-3 text-ink shadow-[0_18px_40px_-16px_rgba(10,8,30,.7)]"
          style={{ left: pop.left, top: pop.top }}>
          <button type="button" onClick={close} aria-label="Close"
            className="absolute top-1.5 right-1.5 grid size-8 cursor-pointer place-items-center rounded-lg text-xl text-ink-soft hover:bg-ink/10">×</button>
          {evidence?.status === "loading" && <p className="m-0 py-4 text-sm text-ink-soft">Loading the evidence…</p>}
          {evidence?.status === "error" && <p className="m-0 py-2 pr-6 text-sm text-berry">{evidence.message}</p>}
          {evidence?.status === "ready" && (evidence.entry ? (
            <>
              <p className="m-0 text-xs text-ink-soft">
                {/* The tree opens its growth panel, the date opens the journal, each at this entry */}
                <button type="button" onClick={() => openTrail(selection.pillar, evidence.entry!.item_id)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-moss hover:text-ink">{selection.pillar.name}</button>
                {", "}
                <button type="button" onClick={() => openHistory({ journalId: evidence.entry!.journal_id, quote: evidence.entry!.evidence_quote })}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-moss hover:text-ink">
                  {selection.kind === "knot" ? "a recent knot" : formatDate(evidence.entry.date)}
                </button>
              </p>
              <p className="mt-1 mr-6 mb-2 font-bold">{evidence.entry.interpretation}</p>
              <blockquote className={`m-0 px-3 py-1.5 font-display text-sm leading-snug ${selection.kind === "knot" ? "bg-amber/15" : "bg-lichen/15"}`}>
                &ldquo;{evidence.entry.evidence_quote}&rdquo;
              </blockquote>
              {selection.kind === "knot" && <p className="mt-1.5 mb-0 text-xs text-ink-soft">A knot forms when something gets in the way.</p>}
            </>
          ) : (
            <p className="m-0 py-2 pr-6 text-sm text-ink-soft">We couldn&apos;t find the words for this leaf.</p>
          ))}
        </div>
      )}

      {/* Tomorrow's Lantern: a lantern on a post, with its next step written in the card beside it */}
      <aside ref={lanternRef} aria-label="Tomorrow's Lantern"
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

      {flight && <LeafFlight from={flight.from} to={flight.to} angle={flight.angle} length={flight.length} color={flight.color}
        onLanded={() => landed(flight.pillarId)} />}

      {trailPillar && <ProgressDrawer pillar={trailPillar} focusItemId={trailFocus} onClose={() => setTrailPillar(null)} />}
      {historyOpen && <JournalHistory key={historyFocus ? `${historyFocus.journalId}:${historyFocus.quote}` : "all"} pillars={pillars} focus={historyFocus} onClose={() => setHistoryOpen(false)} />}

      <div role="toolbar" aria-label="Zoom"
        className={`absolute right-4 ${trailPillar || panelOpen ? "min-[900px]:right-[calc(440px+1rem)]" : ""} bottom-[calc(1.4rem+env(safe-area-inset-bottom))] z-10 flex gap-0.5 rounded-full bg-dusk-deep/80 p-1 max-[900px]:top-[calc(5.2rem+env(safe-area-inset-top))] max-[900px]:right-3 max-[900px]:bottom-auto`}>
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
