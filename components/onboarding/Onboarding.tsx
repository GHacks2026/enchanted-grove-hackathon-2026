"use client";

// Onboarding (issue #1): goal -> AI suggests 4-6 pillars -> user renames, edits, adds or
// removes them -> POST /api/grove creates the Grove (CONTRACT §5, §8).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createGrove, RequestError, suggestPillars } from "@/lib/client";
import { pillarColor } from "@/components/tree/colors";
import { Fireflies, Sky } from "@/components/grove/Atmosphere";

const IDEAS = ["Become a strong software engineer", "Run my first half marathon", "Finish writing my novel", "Get into grad school"];
const MAX_PILLARS = 6;

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
      setError(e instanceof RequestError ? e.message : "Sprout couldn't suggest pillars just now. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function plant() {
    const pillars = rows.map(r => ({ name: r.name.trim(), description: r.description.trim() })).filter(p => p.name);
    if (!pillars.length) { setError("Add at least one pillar to plant your Grove."); return; }
    const names = pillars.map(p => p.name.toLowerCase());
    if (new Set(names).size !== names.length) { setError("Two pillars have the same name. Rename one so each tree is distinct."); return; }
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

  const field = "w-full rounded-lg border-[1.5px] border-line bg-field px-3 py-2 text-ink outline-none placeholder:text-[#8C8A96] focus:border-moss focus:shadow-[0_0_0_3px_rgba(233,180,76,.45)]";
  const named = rows.filter(r => r.name.trim()).length;

  if (step === "pillars") {
    return (
      <main className="bg-grove relative flex min-h-dvh justify-center overflow-hidden px-3 py-6 sm:px-5 sm:py-10">
        <Sky moonOnPhones={false} />
        <section className="relative w-full max-w-[720px] self-start rounded-[22px] bg-panel px-5 py-6 text-ink shadow-[0_30px_70px_-36px_rgba(10,8,30,.8)] sm:px-8">
          <button type="button" onClick={() => { setStep("goal"); setError(""); }}
            className="cursor-pointer border-0 bg-transparent p-0 font-bold text-moss hover:underline">‹ Change goal</button>
          <p className="mt-3 mb-1 font-display text-lg text-ink-soft">{goal}</p>
          <h1 className="m-0 font-display text-3xl leading-tight font-normal sm:text-4xl">The areas your Grove will grow in</h1>
          <p className="mt-2 mb-5 max-w-[56ch] text-ink-soft">
            Sprout suggested these pillars for your goal. Each one becomes a tree. Rename, reword, remove or add your own.
          </p>

          <ol className="m-0 grid list-none gap-3 p-0">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-start gap-3 rounded-r-2xl border border-l-[5px] border-line bg-field py-3 pr-2 pl-3"
                style={{ borderLeftColor: pillarColor(i) }}>
                <svg aria-hidden viewBox="0 0 24 32" width="22" height="30" className="mt-1 flex-none">
                  <path d="M12 31 Q 11 20 12 12" stroke="#6B4E3A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  <ellipse cx="12" cy="9" rx="4" ry="6.5" fill={pillarColor(i)} />
                </svg>
                <div className="grid min-w-0 flex-1 gap-2">
                  <input data-row={r.key} type="text" value={r.name} maxLength={40} placeholder="Pillar name"
                    aria-label={`Pillar ${i + 1} name`} onChange={e => edit(r.key, { name: e.target.value })} className={`${field} font-bold`} />
                  <input type="text" value={r.description} maxLength={120} placeholder="What belongs here (optional)"
                    aria-label={`Pillar ${i + 1} description`} onChange={e => edit(r.key, { description: e.target.value })} className={`${field} text-[.95rem]`} />
                </div>
                <button type="button" onClick={() => remove(r.key)} aria-label={`Remove ${r.name || "this pillar"}`}
                  className="grid size-9 flex-none cursor-pointer place-items-center rounded-lg text-2xl text-ink-soft hover:bg-berry/10 hover:text-berry">×</button>
              </li>
            ))}
          </ol>

          {rows.length < MAX_PILLARS ? (
            <button type="button" onClick={add}
              className="mt-3 cursor-pointer rounded-full border-[1.5px] border-moss bg-transparent px-4 py-2 font-bold text-moss hover:bg-moss/10">+ Add a pillar</button>
          ) : (
            <p className="mt-3 mb-0 text-sm text-ink-soft">Six pillars is the most a Grove holds.</p>
          )}

          {error && <p role="alert" className="mt-3 mb-0 text-sm text-berry">{error}</p>}
          {alreadyExists && (
            <div role="alert" className="mt-3 rounded-xl border border-amber/50 bg-amber/15 px-4 py-3 text-sm">
              A Grove already exists, so a new one can&apos;t be planted. To start over, the database needs resetting with the script in <code>seed/</code>.{" "}
              <Link href="/" className="font-bold text-moss underline">Go to the existing Grove</Link>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
            <p className="m-0 max-w-[34ch] text-sm text-ink-soft">
              {named} {named === 1 ? "tree" : "trees"}. Pillars can&apos;t be changed after planting, for now.
            </p>
            <button type="button" onClick={plant} disabled={busy === "planting"}
              className="cursor-pointer rounded-full bg-moss px-6 py-3 font-bold text-panel hover:bg-[#334B2B] disabled:opacity-60 max-sm:w-full">
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
      <p className="relative z-10 m-0 font-display text-2xl text-sky-soft">Sprout</p>
      <section className="relative z-10 m-auto w-full max-w-[760px] pb-[8vh]">
        <h1 id="ask" className="m-0 text-center font-display text-5xl leading-none font-normal sm:text-7xl">What do you want to grow?</h1>
        <p className="mx-auto mt-4 mb-8 max-w-[46ch] text-center text-lg text-sky-soft">
          Name a meaningful goal. Sprout turns it into a Grove, then helps you see the progress you&apos;re already making.
        </p>
        <form onSubmit={submit} aria-labelledby="ask" aria-busy={!!busy}
          className={`flex items-end gap-2 rounded-[30px] border-2 border-transparent bg-field py-2 pr-2 pl-5 text-ink shadow-[0_24px_50px_-24px_rgba(10,8,30,.7)] focus-within:border-amber max-sm:flex-wrap max-sm:rounded-3xl ${busy ? "animate-glow" : ""}`}>
          <textarea ref={goalRef} rows={1} value={goal} disabled={!!busy} maxLength={200}
            onChange={e => { setGoal(e.target.value); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); suggest(); } }}
            placeholder="Describe a goal in your own words" aria-label="Your goal"
            className="max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent py-2.5 text-lg outline-none placeholder:text-[#8C8A96] max-sm:basis-full" />
          <button type="submit" disabled={!!busy}
            className="flex-none cursor-pointer rounded-full bg-moss px-5 py-3 font-bold text-panel hover:bg-[#334B2B] disabled:opacity-60 max-sm:w-full">
            {busy ? "Thinking…" : "Suggest pillars"}
          </button>
        </form>
        <div className="min-h-24 pt-4" aria-live="polite">
          {busy ? (
            <p className="m-0 text-center text-amber">Finding the areas this goal grows in…</p>
          ) : error ? (
            <p role="alert" className="m-0 text-center text-[#F2B8C6]">{error}</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 text-sm text-sky-soft">Try</span>
              {IDEAS.map(i => (
                <button key={i} type="button" onClick={() => { setGoal(i); suggest(i); }}
                  className="cursor-pointer rounded-full border border-sky/30 bg-sky/10 px-3 py-1 text-sm text-sky hover:bg-sky/20">{i}</button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
