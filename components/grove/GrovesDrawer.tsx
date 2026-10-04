"use client";

// Every grove the user has planted (GET /api/groves, CONTRACT §8), in a side panel beside the Grove.
// Picking one makes it the active grove; planting a new one goes through onboarding. Deleting one asks first.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getGroves, RequestError } from "@/lib/client";
import type { Grove } from "@/lib/types";
import TornSheet from "@/components/journal/TornSheet";
import CloseIcon from "@/components/CloseIcon";
import Fleuron from "@/components/Fleuron";
import LeafMark from "@/components/tree/LeafMark";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

type State = { status: "loading" } | { status: "ready"; groves: Grove[] } | { status: "error" };

/** `onSwitch` / `onDelete` resolve once the Grove shows the result, or throw if the change failed. */
export default function GrovesDrawer({ activeId, onSwitch, onDelete, onClose }: {
  activeId: string; onSwitch: (groveId: string) => Promise<void>; onDelete: (groveId: string) => Promise<void>; onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [switching, setSwitching] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    getGroves().then(groves => live && setState({ status: "ready", groves })).catch(() => live && setState({ status: "error" }));
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(id: string) {
    setSwitching(id);
    setError("");
    try {
      await onSwitch(id);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "Couldn't switch groves. Try again.");
      setSwitching(null);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    setError("");
    try {
      await onDelete(id);
      setState(s => (s.status === "ready" ? { status: "ready", groves: s.groves.filter(g => g.id !== id) } : s));
      setConfirming(null);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "Couldn't delete that grove. Try again.");
    } finally {
      setDeleting(null);
    }
  }

  const busy = !!switching || !!deleting;

  return (
    <TornSheet aria-labelledby="groves-title" className="flex flex-col">
      <header className="relative px-3 pt-6 pb-2 text-center">
        <h2 id="groves-title" className="m-0 font-heading text-title">Your groves</h2>
        {state.status === "ready" && (
          <p className="mt-1 mb-0 font-display text-ink-soft italic">
            {state.groves.length} {state.groves.length === 1 ? "grove" : "groves"}, newest first
          </p>
        )}
        <Fleuron className="mx-auto mt-3" />
        <button type="button" onClick={onClose} aria-label="Close" autoFocus
          className="absolute top-3 right-1 grid size-10 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink"><CloseIcon /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4 [scrollbar-color:var(--color-page-edge)_transparent] [scrollbar-width:thin]">
        {state.status === "loading" && <p className="m-0 py-8 text-center text-ink-soft" role="status">Loading your groves…</p>}
        {state.status === "error" && (
          <div role="alert" className="py-8 text-center">
            <p className="mt-0 text-berry">Couldn&apos;t load your groves right now.</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)}
              className="cursor-pointer rounded-full border-[1.5px] border-moss px-4 py-2 font-bold text-moss hover:bg-moss/10">Try again</button>
          </div>
        )}
        {state.status === "ready" && (
          <ul className="m-0 grid list-none gap-3 p-0">
            {state.groves.map(g => {
              const current = g.id === activeId;
              if (confirming === g.id) return (
                <li key={g.id} role="alert" className="rounded-lg border border-berry/50 bg-berry/10 px-4 py-3">
                  <p className="m-0 font-display text-lg font-medium">Delete {g.title}?</p>
                  <p className="mt-1 mb-3 text-sm text-ink-soft">Its trees and every journal entry in it are deleted for good.</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirming(null)} disabled={!!deleting} autoFocus
                      className="cursor-pointer rounded-full border-[1.5px] border-moss px-4 py-1.5 text-sm font-bold text-moss hover:bg-moss/10 disabled:opacity-60">Cancel</button>
                    <button type="button" onClick={() => remove(g.id)} disabled={!!deleting}
                      className="cursor-pointer rounded-full bg-berry px-4 py-1.5 text-sm font-bold text-panel hover:bg-[#9E3A58] disabled:cursor-wait disabled:opacity-60">
                      {deleting === g.id ? "Deleting…" : "Delete grove"}
                    </button>
                  </div>
                </li>
              );
              return (
                <li key={g.id} className="relative">
                  <button type="button" onClick={() => pick(g.id)} disabled={current || busy} aria-current={current || undefined}
                    className={`grid w-full gap-1 rounded-lg border px-4 py-3 text-left transition-colors ${current
                      ? "cursor-default border-moss/60 bg-lichen/20"
                      : "cursor-pointer border-page-edge bg-page-light/60 hover:border-moss/60 hover:bg-page-light disabled:cursor-wait disabled:opacity-60"}`}>
                    <span className="flex items-center gap-2">
                      <LeafMark color={current ? "var(--color-moss)" : "var(--color-lichen)"} size={12} className="flex-none" />
                      <span className="min-w-0 flex-1 truncate font-display text-lg font-medium">{g.title}</span>
                      {current && <span className="flex-none rounded-full bg-moss px-2 py-0.5 text-xs font-bold text-panel">Current</span>}
                      {switching === g.id && <span className="flex-none text-xs font-bold text-moss" role="status">Switching…</span>}
                    </span>
                    <span className="text-sm text-ink">{g.goal}</span>
                    <span className="font-label text-xs tracking-[.03em] text-ink-soft">Planted {formatDay(g.created_at)}</span>
                  </button>
                  {/* Beside the card, not inside it: a button can't hold another button */}
                  <button type="button" onClick={() => { setError(""); setConfirming(g.id); }} disabled={busy} aria-label={`Delete ${g.title}`}
                    className="absolute right-2 bottom-2 grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-berry/10 hover:text-berry disabled:opacity-50">
                    <svg aria-hidden viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 8.5h6.6l.7-8.5M6.8 7v4M9.2 7v4" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p role="alert" className="mt-3 mb-0 text-center text-sm text-berry">{error}</p>}
      </div>

      <footer className="border-t border-page-edge px-4 pt-3 pb-4">
        <Link href="/onboarding?new=1"
          className="moss-cover flex items-center justify-center gap-2 px-5 py-3 font-bold text-panel">
          <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Plant a new grove
        </Link>
      </footer>
    </TornSheet>
  );
}
