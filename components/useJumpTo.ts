"use client";

import { useEffect, useState } from "react";

/** Once a panel's list has loaded, scroll the element with this id into view and briefly mark it
 *  (its date glows briefly, see jumpDate).
 *  Returns the id while it should be marked. */
export function useJumpTo(targetId: string | null | undefined, ready: boolean) {
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(targetId);
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [targetId, ready]);
  return flash;
}

/** Classes for an entry's date: normally bold grey; dark, extra bold and glowing amber while it's the
 *  jumped-to entry. The padding is offset by a negative margin so nothing moves. */
export const jumpDate = (marked: boolean) =>
  `-mx-1 rounded-md px-1 text-sm transition-[color,background-color,box-shadow] duration-700 ${marked
    ? "bg-amber/25 font-extrabold text-ink shadow-[0_0_12px_4px_rgba(233,180,76,.5)]"
    : "bg-transparent font-bold text-ink-soft shadow-none"}`;
