"use client";

// The Grove home view (issue #2): one tree per Pillar, pan and zoom,
// tap a leaf or knot to see the user's own words, Lantern, and the journal button.
// GET /api/grove only sends leaf_count and has_knot, so evidence loads from
// GET /api/pillars/:id/trail when a leaf or knot is tapped (CONTRACT §8).
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getTrail } from "@/lib/client";
import type { GroveData, GrovePillar, TrailData, TrailEntry } from "@/lib/client";
import PillarTree from "@/components/tree/PillarTree";
import { layoutGrove } from "./groveLayout";
import { buildTree, GROUND_Y, LEAF_LENGTH, TREE_W } from "@/components/tree/treeModel";
import { MAX_ZOOM, MIN_ZOOM, useCamera } from "./useCamera";
import type { Camera } from "./useCamera";
import { Fireflies, Sky } from "./Atmosphere";
import LanternPost from "./LanternPost";
import FreedMoths from "./FreedMoths";
import ProgressDrawer from "@/components/trail/ProgressDrawer";
import JournalHistory from "@/components/journal/JournalHistory";
import LeafFlight from "./LeafFlight";
import LeafPopup from "./LeafPopup";
import KnotPopup from "./KnotPopup";
import { pillarColor } from "@/components/tree/colors";
import CloseIcon from "@/components/CloseIcon";

type Selection = { kind: "leaf" | "knot"; pillar: GrovePillar; index: number; anchor: Element };
type Evidence = { status: "loading" } | { status: "ready"; entry: TrailEntry | null } | { status: "error"; message: string };

// Drawn marks for the zoom controls, one stroke weight: minus, plus, and four corners for "fit"
const ZOOM_BUTTONS = [
  { key: "out", aria: "Zoom out", d: "M3.5 8h9" },
  { key: "in", aria: "Zoom in", d: "M3.5 8h9M8 3.5v9" },
  { key: "fit", aria: "Fit the whole Grove", d: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" },
] as const;

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
  const headerRef = useRef<HTMLElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const trails = useRef(new Map<string, TrailData>());
  const [trailPillar, setTrailPillar] = useState<GrovePillar | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Any 440px panel on the right (journal, progress, history): the frame's controls make room for it
  const sideOpen = panelOpen || !!trailPillar || historyOpen;
  // Where to jump in a panel when it's opened from a leaf's pop-up
  const [trailFocus, setTrailFocus] = useState<string | null>(null);
  const [historyFocus, setHistoryFocus] = useState<{ journalId: string; quote: string } | null>(null);
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  // New leaves still flying in, per tree (not drawn until they land), the queue, and the one in the air
  const [inFlight, setInFlight] = useState<Record<string, number>>({});
  const [flew, setFlew] = useState(false);
  // Followed the last Lantern: it flares up and says so, once the new leaves have landed
  const [lanternCelebrate, setLanternCelebrate] = useState(false);
  // Each time the user follows their Lantern its moths fly off and stay on as fireflies for this visit
  const rootRef = useRef<HTMLDivElement>(null);
  const lanternRef = useRef<HTMLElement>(null);
  // Tapping the lantern tucks its step away (and back); the lantern itself stays
  const [lanternTucked, setLanternTucked] = useState(false);
  const [freedMoths, setFreedMoths] = useState<{ seed: number; from: { x: number; y: number }; area: { w: number; h: number } }[]>([]);
  useEffect(() => {
    const root = rootRef.current, lamp = lanternRef.current?.querySelector("[data-lantern]");
    if (!lanternCelebrate || !root || !lamp) return;
    const r = root.getBoundingClientRect(), l = lamp.getBoundingClientRect();
    setFreedMoths(m => [...m, { seed: Date.now(), from: { x: l.left + l.width / 2 - r.left, y: l.top + l.height * 0.55 - r.top }, area: { w: r.width, h: r.height } }]);
  }, [lanternCelebrate]);
  const shownLantern = useRef(data.lantern);
  const [freshLantern, setFreshLantern] = useState(false);
  useEffect(() => {
    if (data.lantern && data.lantern !== shownLantern.current) setFreshLantern(true);
    shownLantern.current = data.lantern;
  }, [data.lantern]);
  const celebrateAfterFlights = useRef(false);
  const flightQueue = useRef<{ pillarId: string; from: { x: number; y: number } | null }[]>([]);
  const [flight, setFlight] = useState<{ pillarId: string; from: { x: number; y: number }; to: { x: number; y: number }; angle: number; length: number; color: string } | null>(null);
  const [showTip, setShowTip] = useState(false);

  // Newly grown leaves fly in from the review, one at a time (LeafFlight). The review screen leaves
  // a note in sessionStorage after confirming; ?preview=new-leaves plays it without one.
  // A layout effect, so new leaves are hidden before the first paint rather than flickering.
  useLayoutEffect(() => {
    let leaves: { pillarId: string; from: { x: number; y: number } | null }[] = [];
    let followed = false;
    try {
      const params = new URLSearchParams(window.location.search);
      followed = params.get("preview") === "lantern-followed" || sessionStorage.getItem("sprout:lantern-followed") === "1";
      sessionStorage.removeItem("sprout:lantern-followed");
      if (new URLSearchParams(window.location.search).get("preview") === "new-leaves") {
        leaves = data.pillars.filter(p => p.leaf_count > 0).map(p => ({ pillarId: p.id, from: null }));
      } else {
        const note = sessionStorage.getItem("sprout:new-leaves");
        if (note) { leaves = JSON.parse(note).leaves ?? []; sessionStorage.removeItem("sprout:new-leaves"); }
      }
      setShowTip(!localStorage.getItem("sprout:tip-seen"));
    } catch { /* storage blocked: skip the extras */ }
    leaves = leaves.filter(l => data.pillars.some(p => p.id === l.pillarId));
    celebrateAfterFlights.current = followed && leaves.length > 0;
    if (followed && !leaves.length) { const t = setTimeout(() => setLanternCelebrate(true), 700); return () => clearTimeout(t); }
    if (!leaves.length) return;
    const counts: Record<string, number> = {};
    for (const l of leaves) counts[l.pillarId] = (counts[l.pillarId] ?? 0) + 1;
    setNewCounts(counts);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { if (followed) setLanternCelebrate(true); return; } // just show them
    setInFlight(counts);
    setFlew(true);
    flightQueue.current = leaves;
    const t = setTimeout(() => launchNext.current(), 700); // let the Grove settle after the panel closes
    return () => clearTimeout(t);
  }, [data.pillars]);
  const dismissTip = () => { setShowTip(false); try { localStorage.setItem("sprout:tip-seen", "1"); } catch { /* ignore */ } };
  const openTrail = (p: GrovePillar, itemId: string | null = null) => { close(); dismissTip(); setHistoryOpen(false); setTrailFocus(itemId); setTrailPillar(p); };
  const openHistory = (focus: { journalId: string; quote: string } | null = null) => { close(); setTrailPillar(null); setHistoryFocus(focus); setHistoryOpen(true); };

  // ?preview=knots draws a knot on every tree (real knots only show for friction confirmed in the
  // last 3 days). Read after mount so the server and first client render match.
  const [previewKnots, setPreviewKnots] = useState(false);
  useEffect(() => { setPreviewKnots(new URLSearchParams(window.location.search).get("preview") === "knots"); }, []);
  const pillars = useMemo(() => [...data.pillars].sort((a, b) => a.position - b.position)
    .map(p => (previewKnots ? { ...p, has_knot: true } : p)), [data.pillars, previewKnots]);

  // The header (goal and Lantern) sits over the top of the canvas. The trees stand on a ground line
  // just above the bottom row and stay pinned there: panning only moves them sideways, zoom grows them upward.
  const [top, setTop] = useState(160);
  const [bottom, setBottom] = useState(120);
  const groundY = size.h - bottom;
  const layout = useMemo(() => layoutGrove(pillars, size.w, groundY - top), [pillars, size.w, groundY, top]);
  const b = layout.bounds;
  const pinToGround = useCallback((c: Camera) => ({ ...c, y: groundY - (b.y + b.h) * c.k }), [groundY, b]);
  const { camera, animateTo, zoomBy, wasDrag, handlers } = useCamera(viewportRef, pinToGround);

  useLayoutEffect(() => {
    const vp = viewportRef.current, header = headerRef.current, row = bottomRowRef.current;
    if (!vp || !header || !row) return;
    const measure = () => {
      const v = vp.getBoundingClientRect();
      setSize({ w: vp.clientWidth, h: vp.clientHeight });
      // The header's last 24px is only its fade into the sky, so the treetops may reach into it
      setTop(header.getBoundingClientRect().bottom - v.top - 24);
      // 28px between the ground line and the bottom row, so tree names clear the buttons
      setBottom(v.bottom - row.getBoundingClientRect().top + 28);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(header);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback((animate = true) => {
    const k = Math.max(MIN_ZOOM, Math.min((size.w - 60) / b.w, (groundY - top) / b.h, 1.3));
    animateTo({ k, x: size.w / 2 - (b.x + b.w / 2) * k, y: 0 }, animate ? 650 : 0); // y is set by pinToGround
  }, [animateTo, b, size.w, groundY, top]);
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
  }, [animateTo, layout.slots, b, size.w, groundY, top]);
  // Focus when the panel opens or switches trees (and again after a resize); zoom back out when it closes
  const hadTrail = useRef(false);
  useEffect(() => {
    if (trailPillar) focus(trailPillar);
    else if (hadTrail.current) fit();
    hadTrail.current = !!trailPillar;
  }, [trailPillar, focus, fit]);

  // Send the next queued leaf from its card to the spot it will take on its tree (the first one
  // not drawn yet, on the tree one step bigger), using where that spot is on screen right now.
  const launchNext = useRef(() => {});
  launchNext.current = () => {
    const next = flightQueue.current.shift();
    if (!next) {
      if (celebrateAfterFlights.current) { celebrateAfterFlights.current = false; setLanternCelebrate(true); }
      return;
    }
    const slot = layout.slots.find(s => s.pillar.id === next.pillarId);
    if (!slot) return launchNext.current();
    const p = slot.pillar;
    const shown = p.leaf_count - (inFlight[p.id] ?? 1); // its spot on the tree as it will be once it lands
    const leaf = buildTree(p.id, shown + 1).leaves[shown];
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
  useEffect(() => {
    if (!lanternCelebrate) return;
    const t = setTimeout(() => setLanternCelebrate(false), 6000);
    return () => clearTimeout(t);
  }, [lanternCelebrate]);

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
    // A leaf opens as a wider leaf, its stem toward the tapped one; a knot as a slice of wood
    const W = Math.min(340, s.width - 24), H = 240;
    const y = Math.min(Math.max(r.top - s.top - 60, 80), s.height - H - 20);
    if (r.right - s.left + 16 + W < s.width - 12) return { left: r.right - s.left + 16, top: y, stem: "left" as const };
    if (r.left - s.left - 16 - W > 12) return { left: r.left - s.left - 16 - W, top: y, stem: "right" as const };
    return { left: Math.min(Math.max(r.left + r.width / 2 - s.left - W / 2, 12), s.width - W - 12), top: r.bottom - s.top + 12, stem: "left" as const };
  })();

  const noLeaves = pillars.every(p => p.leaf_count === 0);

  return (
    <div ref={rootRef} className="bg-grove relative h-dvh overflow-hidden text-sky">
      <Sky />
      {/* One frame for everything over the canvas: a 24px inset, the goal and Lantern at the top */}
      <header ref={headerRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 bg-linear-to-b from-dusk-deep/85 via-dusk-deep/45 to-transparent px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10">
        <div className="min-w-0">
          <h1 className="m-0 max-w-[34ch] font-heading text-title md:text-headline">{data.grove.goal}</h1>
          {/* Tomorrow's Lantern: the next step toward the goal, read right after it. A small lantern
              hangs beside the step, as if from a branch above the glade. */}
          <aside ref={lanternRef} aria-label="Tomorrow's Lantern"
            className="pointer-events-auto relative mt-6 -ml-2.5 flex max-w-[33rem] items-start gap-3.5 py-2.5 pr-5 pl-2.5">
            {/* The lantern's light on the sky behind the step: a wide ellipse that fades to nothing well
                inside its own (oversized, unclipped) box, so it has no visible edge */}
            {data.lantern && (
              <span aria-hidden className="pointer-events-none absolute top-1/2 -left-6 -z-10 h-[240px] w-[600px] -translate-y-1/2 bg-[radial-gradient(ellipse_440px_105px_at_52px_50%,rgba(233,180,76,.26),rgba(233,180,76,.1)_45%,transparent_100%)]" />
            )}
            <button type="button" onClick={() => setLanternTucked(t => !t)} aria-pressed={lanternTucked}
              aria-label={lanternTucked ? "Show Tomorrow's Lantern" : "Hide Tomorrow's Lantern"}
              className="flex-none cursor-pointer rounded-full transition-[filter] hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">
              <LanternPost lit={!!data.lantern} celebrate={lanternCelebrate || freshLantern} mothsAway={lanternCelebrate} />
            </button>
            {/* Tucked away it fades out but keeps its room, so the trees don't shift */}
            <div key={data.lantern ?? "unlit"} aria-hidden={lanternTucked}
              className={`min-w-0 pt-1 transition-[opacity,visibility] duration-300 [text-shadow:0_1px_10px_rgba(20,18,40,.9)] ${freshLantern ? "animate-rise-in" : ""} ${lanternTucked ? "invisible opacity-0" : ""}`}>
              {data.lantern ? (
                <>
                  <p className="m-0 font-label text-sm font-bold text-amber">Tomorrow&apos;s Lantern</p>
                  <p className="mt-0.5 mb-0 text-base font-medium text-[#F3E4C2]">{data.lantern}</p>
                </>
              ) : (
                <p className="m-0 text-base font-medium text-sky-soft">Your Lantern lights up with a small next step after your first reflection.</p>
              )}
            </div>
            {lanternCelebrate && (
              <p role="status" className="animate-rise-in absolute top-full left-0 mt-2 rounded-full bg-amber px-4 py-1.5 text-sm font-bold text-[#2B2412] shadow-[0_10px_24px_-10px_rgba(10,8,30,.8)]">
                You followed your Lantern ✓
              </p>
            )}
          </aside>
        </div>
      </header>

      {/* The journal pages float beside the Grove, which makes room for them. Its edge runs on under
          the page's solid paper, so the cut never shows through the gap or the torn edge. */}
      <div
        ref={viewportRef}
        className={`absolute inset-0 ${panelOpen || historyOpen ? "min-[900px]:right-[400px]" : ""} cursor-grab touch-none overflow-hidden outline-none active:cursor-grabbing focus-visible:shadow-[inset_0_0_0_3px_var(--color-amber)]`}
        tabIndex={0}
        role="region"
        aria-label="Your Grove. Drag to look around, scroll or pinch to zoom."
        {...handlers}
        onClick={e => { if (!wasDrag() && !(e.target as Element).closest("[role=button], button, a")) close(); }}
      >
        <div className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`, "--cam-k": camera.k } as CSSProperties}>
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
                flownIn={flew}
                onOpenTrail={() => openTrail(pillar)}
              />
            </div>
          ))}
        </div>

        {noLeaves && (
          <p className="pointer-events-none absolute top-[22%] left-1/2 z-[2] m-0 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 text-center font-medium text-sky-soft">
            Your trees are seedlings. Each thing you do toward your goal becomes a leaf once you confirm it.
          </p>
        )}
      </div>

      <Fireflies />
      {freedMoths.map(m => <FreedMoths key={m.seed} from={m.from} area={m.area} seed={m.seed} />)}
      <div aria-hidden className="grain-overlay pointer-events-none absolute inset-0 z-[5]" />

      {selection && pop && (() => {
        const onLeaf = selection.kind === "leaf";
        // The tree and the date are small pill links with an arrow, so they read as places to go, in the
        // pop-up's own deep ink (the tree's color on a leaf, bark on a knot). The quote sits on the surface.
        const link = "inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-(--pop-ink)/35 bg-white/55 py-0.5 pr-1.5 pl-2.5 text-[0.6875rem] font-bold text-(--pop-ink) transition-colors hover:border-(--pop-ink)/70 hover:bg-white/90";
        const go = <svg aria-hidden viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5L10.5 8 6 12.5" /></svg>;
        const content = (
          <>
            <button type="button" onClick={close} aria-label="Close"
              className={`absolute ${onLeaf ? "top-[19%] right-[18%]" : "top-[10%] right-[10%]"} grid size-7 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink`}><CloseIcon size={14} /></button>
            {evidence?.status === "loading" && <p className="m-0 py-4 text-sm text-ink-soft">Loading the evidence…</p>}
            {evidence?.status === "error" && <p className="m-0 py-2 pr-6 text-sm text-berry">{evidence.message}</p>}
            {evidence?.status === "ready" && (evidence.entry ? (
              <>
                <p className="m-0 mr-8 flex flex-wrap gap-1.5">
                  {/* The tree opens its growth panel, the date opens the journal, each at this entry */}
                  <button type="button" onClick={() => openTrail(selection.pillar, evidence.entry!.item_id)}
                    aria-label={`See ${selection.pillar.name}'s growth`} className={link}>{selection.pillar.name}{go}</button>
                  <button type="button" onClick={() => openHistory({ journalId: evidence.entry!.journal_id, quote: evidence.entry!.evidence_quote })}
                    aria-label={`Read the journal entry from ${formatDate(evidence.entry.date)}`} className={link}>
                    {selection.kind === "knot" ? "a recent knot" : formatDate(evidence.entry.date)}{go}
                  </button>
                </p>
                <p className="mt-1.5 mb-1 text-sm leading-snug font-bold">{evidence.entry.interpretation}</p>
                <blockquote className="m-0 font-display text-[0.9375rem] leading-snug">
                  &ldquo;{evidence.entry.evidence_quote}&rdquo;
                </blockquote>
                {!onLeaf && <p className="mt-1.5 mb-0 font-display text-xs text-[#6B4E3A] italic">A knot forms when something gets in the way.</p>}
              </>
            ) : (
              <p className="m-0 py-2 pr-6 text-sm text-ink-soft">We couldn&apos;t find the words for this leaf.</p>
            ))}
          </>
        );
        return selection.kind === "leaf" ? (
          <LeafPopup color={pillarColor(selection.pillar.position)} stem={pop.stem} label="What this leaf is"
            style={{ left: pop.left, top: pop.top }}>{content}</LeafPopup>
        ) : (
          <KnotPopup label="Recent friction" style={{ left: pop.left, top: pop.top }}>{content}</KnotPopup>
        );
      })()}

      {/* The bottom of the frame: journal, Reflect and zoom centred on one line, Reflect centred on the visible Grove */}
      <div ref={bottomRowRef} className={`pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 ${sideOpen ? "min-[900px]:right-[440px]" : ""} max-[900px]:grid-cols-[1fr_auto]`}>
        {/* Same height as the zoom pill (h-12) so the two side controls match */}
        <button type="button" onClick={() => openHistory()}
          className="pointer-events-auto flex h-12 cursor-pointer items-center justify-self-start night-frame rounded-full px-5 text-sm font-bold text-sky backdrop-blur hover:bg-dusk focus-visible:outline-2 focus-visible:outline-amber">
          Your journal
        </button>

        {/* Already reflecting: the panel is the action, so the button steps aside */}
        {panelOpen ? <span /> : (
          <Link href="/reflect"
            className="journal-cover pointer-events-auto flex items-center gap-2.5 py-3.5 pr-7 pl-6 font-heading text-[1.5rem] leading-none text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber max-[900px]:justify-center max-[900px]:justify-self-stretch">
            {/* A quill: writing in the journal */}
            <svg aria-hidden viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="var(--color-moss)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <path d="M17 3C11 3.5 7 7.5 5.5 13.5" />
              <path d="M17 3c-.5 5.5-4.5 9.5-10 10.5" />
              <path d="M10.5 9.5 3 17" />
            </svg>
            Reflect on your day
          </Link>
        )}

        <div role="toolbar" aria-label="Zoom"
          className="pointer-events-auto night-frame flex gap-0.5 justify-self-end rounded-full p-1.5 backdrop-blur">
          {ZOOM_BUTTONS.map(b => (
            <button key={b.key} type="button" onClick={() => (b.key === "fit" ? fit() : zoomBy(b.key === "in" ? 1.25 : 0.8, undefined, undefined, true))} aria-label={b.aria}
              className="grid size-9 cursor-pointer place-items-center rounded-full text-sky hover:bg-sky/10 focus-visible:outline-2 focus-visible:outline-amber">
              <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d={b.d} />
              </svg>
            </button>
          ))}
        </div>
      </div>


      {showTip && !trailPillar && (
        <div role="note" style={{ top: top + 24 }} className={`absolute left-1/2 z-10 flex w-max max-w-[calc(100%-3rem)] -translate-x-1/2 items-center gap-3 night-frame rounded-full py-2 pr-2 pl-4 text-sm font-medium text-sky backdrop-blur ${sideOpen ? "min-[900px]:left-[calc(50%-220px)]" : ""}`}>
          <span>Tap a tree to see your progress, or a leaf for that one moment.</span>
          <button type="button" onClick={dismissTip} aria-label="Dismiss tip" className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-sky/15"><CloseIcon size={12} /></button>
        </div>
      )}

      {flight && <LeafFlight from={flight.from} to={flight.to} angle={flight.angle} length={flight.length} color={flight.color}
        onLanded={() => landed(flight.pillarId)} />}

      {trailPillar && <ProgressDrawer pillar={trailPillar} focusItemId={trailFocus} onClose={() => setTrailPillar(null)} />}
      {historyOpen && <JournalHistory key={historyFocus ? `${historyFocus.journalId}:${historyFocus.quote}` : "all"} pillars={pillars} focus={historyFocus} onClose={() => setHistoryOpen(false)} />}

    </div>
  );
}
