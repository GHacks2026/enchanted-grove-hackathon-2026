"use client";

// Loads the Grove and handles the states around it (CONTRACT §8):
// loading, error with retry, 404 -> /onboarding, otherwise the Grove itself.
// It stays mounted on /reflect (see app/(grove)/layout.tsx), with the journal in a side panel beside it.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getGrove, RequestError } from "@/lib/client";
import type { GroveData } from "@/lib/client";
import GroveCanvas from "./GroveCanvas";
import { Sky } from "./Atmosphere";

type State = { status: "loading" } | { status: "ready"; data: GroveData } | { status: "none" } | { status: "error"; message: string };

export default function GroveHome({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const router = useRouter();
  const reflecting = usePathname() === "/reflect";

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await getGrove();
      setState(data ? { status: "ready", data } : { status: "none" });
    } catch (e) {
      setState({ status: "error", message: e instanceof RequestError ? e.message : "Your Grove couldn't load." });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (state.status === "none" && !reflecting) router.replace("/onboarding"); }, [state.status, reflecting, router]);

  // Back from the journal: refresh quietly, with no loading screen, to show newly confirmed leaves.
  // If nothing changed, keep the same data so the trees and camera stay exactly where they were.
  const wasReflecting = useRef(reflecting);
  useEffect(() => {
    if (wasReflecting.current && !reflecting) {
      getGrove()
        .then(data => data && setState(s => s.status === "ready" && JSON.stringify(s.data) === JSON.stringify(data) ? s : { status: "ready", data }))
        .catch(() => { /* keep showing what we have */ });
    }
    wasReflecting.current = reflecting;
  }, [reflecting]);

  if (state.status === "ready") return <><GroveCanvas data={state.data} panelOpen={reflecting} />{children}</>;
  // Opened /reflect directly: the journal doesn't need to wait for the Grove
  if (reflecting) return <main className="bg-grove relative min-h-dvh overflow-hidden"><Sky moonOnPhones={false} />{children}</main>;

  return (
    <main className="bg-grove grid min-h-dvh place-content-center gap-3 p-8 text-center text-sky">
      {state.status === "loading" && <p className="m-0 text-sky-soft" role="status">Loading your Grove…</p>}
      {state.status === "error" && (
        <div role="alert">
          <h1 className="m-0 font-display text-3xl font-normal">Your Grove didn&apos;t load</h1>
          <p className="text-sky-soft">{state.message}</p>
          <button type="button" onClick={load}
            className="cursor-pointer rounded-full bg-amber px-5 py-2.5 font-bold text-[#2B2412] hover:bg-[#F0C266]">Try again</button>
        </div>
      )}
      {state.status === "none" && <p className="m-0 text-sky-soft" role="status">Taking you to set up your Grove…</p>}
    </main>
  );
}
