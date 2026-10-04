// A journal page torn out and laid beside the Grove (the Grove makes room for it), with ripped
// edges and a pale rim where it tore. Children are inset clear of the tear.
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Classes for the page itself (its layout and padding) */
  className?: string;
  /** Stacking order, e.g. the journal sits above the history */
  z?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export default function TornSheet({ children, className = "", z = "z-40", ...aria }: Props) {
  return (
    <div className={`fixed top-4 right-4 bottom-4 ${z} w-[min(408px,calc(100%-2rem))] [filter:drop-shadow(-6px_14px_18px_rgb(10_8_30/.55))_drop-shadow(0_2px_3px_rgb(10_8_30/.35))]`}>
      <div aria-hidden className="torn-rim absolute inset-0" />
      <aside {...aria} className={`torn-paper absolute inset-[2px] px-3 py-2 text-ink ${className}`}>
        {children}
      </aside>
    </div>
  );
}
