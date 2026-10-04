"use client";

// Onboarding (issue #1): goal -> AI suggests 4-6 pillars -> user renames, edits, adds or
// removes them -> POST /api/grove creates the Grove (CONTRACT §5, §8).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createGrove, RequestError, suggestPillars } from "@/lib/client";
import { pillarColor, shade } from "@/components/tree/colors";
import { Fireflies, Sky } from "@/components/grove/Atmosphere";
import CloseIcon from "@/components/CloseIcon";
import Sprout from "./Sprout";

const IDEAS = ["Become a strong software engineer", "Run my first half marathon", "Finish writing my novel", "Get into grad school"];
const MAX_PILLARS = 6;
// Packets lie a little askew on the page, and straighten when picked up (hovered or edited).
// Each packet's seed sprouts once its pillar has a name.
const TILT = [-0.8, 0.5, -0.3, 0.7, -0.6, 0.35];

type Row = { key: number; name: string; description: string };

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<"goal" | "pillars">("goal");
  const [goal, setGoal] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<"suggesting" | "planting" | null>(null);
  const [error, setError] = useState("");
  const [alreadyExists, setAlreadyExists] = useState(false);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const nextKey = useRef(0);

  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [goal, step]);

  async function suggest(text = goal) {
    const g = text.trim();
    if (!g) { setError("Write your goal first, or pick one of the ideas below."); goalRef.current?.focus(); return; }
    setGoal(g);
    setBusy("suggesting");
    setError("");
    try {
      const pillars = await suggestPillars(g);
      setRows(pillars.map(p => ({ key: nextKey.current++, ...p })));
      setStep("pillars");
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "Sprout couldn't suggest trees just now. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function plant() {
    const pillars = rows.map(r => ({ name: r.name.trim(), description: r.description.trim() })).filter(p => p.name);
    if (!pillars.length) { setError("Add at least one tree to plant your Grove."); return; }
    const names = pillars.map(p => p.name.toLowerCase());
    if (new Set(names).size !== names.length) { setError("Two trees have the same name. Rename one so each is distinct."); return; }
    setBusy("planting");
    setError("");
    try {
      await createGrove(goal.trim(), pillars);
      router.push("/");
    } catch (e) {
      if (e instanceof RequestError && e.status === 409) setAlreadyExists(true);
      else setError(e instanceof RequestError ? e.message : "Your Grove couldn't be planted. Try again.");
      setBusy(null);
    }
  }

  const edit = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows(rs => rs.filter(r => r.key !== key));
  const add = () => {
    const key = nextKey.current++;
    setRows(rs => [...rs, { key, name: "", description: "" }]);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-row="${key}"]`)?.focus());
  };

  // Borderless fields written straight onto the packet; a rule appears under them on hover and focus
  const field = "w-full border-0 border-b border-dashed border-transparent bg-transparent px-1 py-0.5 text-center text-ink outline-none placeholder:italic placeholder:text-[#6E695C] hover:border-page-edge focus:border-solid focus:border-moss";
  const named = rows.filter(r => r.name.trim()).length;

  if (step === "pillars") {
    return (
      <main className="bg-grove relative flex min-h-dvh justify-center overflow-hidden px-3 py-6 sm:px-5">
        <Sky moonOnPhones={false} />
        <section className="relative w-full max-w-[980px] paper-page self-start rounded-sm px-6 pt-6 pb-6 text-ink sm:px-10">
          <button type="button" onClick={() => { setStep("goal"); setError(""); }}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-bold text-moss hover:underline hover:underline-offset-2">
            <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg>
            Change goal
          </button>
          <p className="mt-3 mb-1 font-display text-lg text-ink-soft">{goal}</p>
          <h1 className="m-0 font-heading text-title sm:text-headline">The areas your Grove will grow in</h1>
          <p className="mt-2 mb-6 text-ink-soft">
            Sprout suggested these trees for your goal. Rename, reword, remove or add your own.
          </p>

          <ol className="m-0 grid list-none grid-cols-3 gap-x-6 gap-y-6 p-0 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
            {rows.map((r, i) => {
              const c = pillarColor(i);
              return (
                <li key={r.key} style={{ rotate: `${TILT[i % TILT.length]}deg` }}
                  className="relative transition-[rotate] duration-200 drop-shadow-[0_12px_14px_rgb(70_52_20/.22)] focus-within:rotate-0! hover:rotate-0!">
                  <div className="seed-packet flex h-full flex-col rounded-b-[3px] px-4 pb-4">
                    <div aria-hidden className="-mx-4 h-7 border-b border-dashed border-page-edge bg-[repeating-linear-gradient(90deg,rgb(120_98_55/.13)_0_1px,transparent_1px_4px)]" />
                    <div aria-hidden className="mt-3 grid h-[112px] place-items-end overflow-hidden"
                      style={{
                        borderRadius: "50% 50% 4px 4px / 56px 56px 4px 4px",
                        background: `radial-gradient(90% 70% at 50% 100%, ${shade(c, 0.78)}, ${shade(c, 0.62)})`,
                        boxShadow: `inset 0 0 0 1px ${shade(c, -0.15)}, inset 0 0 0 4px ${shade(c, 0.7)}, inset 0 0 0 5px ${shade(c, 0.2)}`,
                      }}>
                      <Sprout color={c} sprouted={!!r.name.trim()} soil={shade(c, -0.45)} delay={0.25 + i * 0.12} className="mx-auto w-[136px]" />
                    </div>
                    <input data-row={r.key} type="text" value={r.name} maxLength={40} placeholder="Name this tree"
                      aria-label={`Tree ${i + 1} name`} onChange={e => edit(r.key, { name: e.target.value })}
                      className={`${field} mt-3 font-display text-[1.375rem] leading-tight font-medium`} />
                    <textarea value={r.description} maxLength={120} rows={2} placeholder="What grows here (optional)"
                      aria-label={`Tree ${i + 1} description`} onChange={e => edit(r.key, { description: e.target.value })}
                      className={`${field} mt-1 resize-none text-sm text-ink-soft`} />
                  </div>
                  <button type="button" onClick={() => remove(r.key)} aria-label={`Remove ${r.name || "this tree"}`}
                    className="absolute top-[5px] right-1.5 grid size-7 cursor-pointer place-items-center rounded-lg text-ink-soft/80 hover:bg-berry/10 hover:text-berry"><CloseIcon size={14} /></button>
                </li>
              );
            })}
            {rows.length < MAX_PILLARS && (
              <li className="min-h-[240px]">
                <button type="button" onClick={add}
                  className="grid size-full cursor-pointer place-items-center content-center gap-2 rounded-[3px] border-[1.5px] border-dashed border-[#B5AA8C] bg-transparent font-bold text-moss hover:border-moss hover:bg-page-light/50">
                  <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Add a tree
                </button>
              </li>
            )}
          </ol>

          {error && <p role="alert" className="mt-4 mb-0 text-sm text-berry">{error}</p>}
          {alreadyExists && (
            <div role="alert" className="mt-3 rounded-xl border border-amber/50 bg-amber/15 px-4 py-3 text-sm">
              A Grove already exists, so a new one can&apos;t be planted. To start over, the database needs resetting with the script in <code>seed/</code>.{" "}
              <Link href="/" className="font-bold text-moss underline">Go to the existing Grove</Link>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
            <p className="m-0 text-sm text-ink-soft">
              {named} {named === 1 ? "tree" : "trees"}.{rows.length >= MAX_PILLARS && " Six trees is the most a Grove holds."} Trees can&apos;t be changed after planting, for now.
            </p>
            <button type="button" onClick={plant} disabled={busy === "planting"}
              className="press cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] disabled:opacity-60 max-sm:w-full">
              {busy === "planting" ? "Planting…" : "Plant my Grove"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const submit = (e: FormEvent) => { e.preventDefault(); suggest(); };
  return (
    <main className="bg-grove relative flex min-h-dvh flex-col overflow-hidden px-4 pt-6 pb-12 text-sky sm:px-6">
      <Sky moonOnPhones={false} />
      <Fireflies />
      <div aria-hidden className="grain-overlay pointer-events-none absolute inset-0" />
      <p className="absolute top-6 left-4 z-10 m-0 sm:left-6 font-display text-2xl font-medium italic text-sky-soft">Sprout</p>
      <section className="relative z-10 m-auto w-full max-w-[760px]">
        <h1 id="ask" className="m-0 text-center font-heading text-hero">What goal do you want to <em>grow?</em></h1>
        <p className="mx-auto mt-4 mb-8 max-w-[46ch] text-center text-lg font-medium text-sky-soft">
          Sprout turns it into a Grove, then helps you see the progress you&apos;re already making.
        </p>
        <form onSubmit={submit} aria-labelledby="ask" aria-busy={!!busy}
          className={`flex items-end gap-2 paper rounded-[30px] py-2 pr-2 pl-5 text-ink focus-within:border-moss focus-within:ring-1 focus-within:ring-moss max-sm:flex-wrap max-sm:rounded-3xl ${busy ? "animate-glow" : ""}`}>
          <textarea ref={goalRef} rows={1} value={goal} disabled={!!busy} maxLength={200}
            onChange={e => { setGoal(e.target.value); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); suggest(); } }}
            placeholder="Describe a goal in your own words" aria-label="Your goal"
            className="max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent py-2.5 text-lg outline-none placeholder:text-[#8C8A96] max-sm:basis-full" />
          <button type="submit" disabled={!!busy}
            className="press flex-none cursor-pointer rounded-full bg-moss px-5 py-3 font-bold text-panel hover:bg-[#334B2B] disabled:opacity-60 max-sm:w-full">
            {busy ? "Thinking…" : "Sprout Grove"}
          </button>
        </form>
        <div className="min-h-24 pt-4" aria-live="polite">
          {busy ? (
            <p className="m-0 text-center font-medium text-sky-soft">Finding the areas this goal grows in…</p>
          ) : error ? (
            <p role="alert" className="m-0 text-center text-[#F2B8C6]">{error}</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 text-sm font-medium text-sky-soft">Try</span>
              {IDEAS.map(i => (
                <button key={i} type="button" onClick={() => { setGoal(i); suggest(i); }}
                  className="cursor-pointer rounded-full border border-sky/30 bg-sky/10 px-3 py-1 text-sm font-medium text-sky hover:bg-sky/20">{i}</button>
              ))}
            </div>
          )}
        </div>
        <Sprout color="#9DB27C" sprouted={!!busy} soil="#22281F" className="mx-auto -mt-8 block w-[176px]" />
      </section>
    </main>
  );
}
