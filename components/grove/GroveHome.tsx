"use client";

// Loads the Grove and handles the states around it (CONTRACT §8):
// loading, error with retry, 404 -> onboarding, otherwise the Grove itself.
import { useCallback, useEffect, useState } from "react";
import { getGrove, RequestError } from "@/lib/client";
import type { GroveData } from "@/lib/client";
import GroveCanvas from "./GroveCanvas";

type State = { status: "loading" } | { status: "ready"; data: GroveData } | { status: "none" } | { status: "error"; message: string };

export default function GroveHome() {
  const [state, setState] = useState<State>({ status: "loading" });

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

  if (state.status === "ready") return <GroveCanvas data={state.data} />;

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
      {state.status === "none" && (
        // Placeholder until the onboarding screen is built.
        <div>
          <h1 className="m-0 font-display text-3xl font-normal">No Grove yet</h1>
          <p className="text-sky-soft">Onboarding will appear here.</p>
        </div>
      )}
    </main>
  );
}
