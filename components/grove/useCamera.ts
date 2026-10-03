"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
export interface Bounds { x: number; y: number; w: number; h: number }

export interface Camera { x: number; y: number; k: number }

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;
const clampK = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Pan and zoom camera for the Grove canvas (issue #2).
 * Screen position = world position * k + (x, y).
 */
export function useCamera(viewportRef: RefObject<HTMLDivElement | null>) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, k: 1 });
  const camRef = useRef(camera);
  const anim = useRef<number | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const set = useCallback((c: Camera) => {
    camRef.current = c;
    setCamera(c);
  }, []);

  const stop = useCallback(() => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  }, []);

  const animateTo = useCallback((target: Camera, ms = 650) => {
    stop();
    if (reduceMotion.current || ms <= 0) return set(target);
    const from = camRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = ease(t);
      set({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  }, [set, stop]);

  /** Fly the camera so a box fills the viewport. */
  const flyTo = useCallback((b: Bounds, opts: { padding?: number; maxZoom?: number; animate?: boolean } = {}) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const pad = opts.padding ?? 60;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const k = clampK(Math.min((vw - pad * 2) / b.w, (vh - pad * 2) / b.h, opts.maxZoom ?? 1.25));
    const target = { k, x: vw / 2 - (b.x + b.w / 2) * k, y: vh / 2 - (b.y + b.h / 2) * k };
    if (opts.animate === false) { stop(); set(target); } else animateTo(target);
  }, [animateTo, set, stop, viewportRef]);

  /** Zoom by a factor around a screen point (defaults to the viewport center). */
  const zoomBy = useCallback((factor: number, px?: number, py?: number, animate = false) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const c = camRef.current;
    const cx = px ?? vp.clientWidth / 2, cy = py ?? vp.clientHeight / 2;
    const k = clampK(c.k * factor);
    const target = { k, x: cx - (cx - c.x) * (k / c.k), y: cy - (cy - c.y) * (k / c.k) };
    if (animate) animateTo(target, 250); else { stop(); set(target); }
  }, [animateTo, set, stop, viewportRef]);

  const panBy = useCallback((dx: number, dy: number) => {
    stop();
    const c = camRef.current;
    set({ ...c, x: c.x + dx, y: c.y + dy });
  }, [set, stop]);

  // Mouse wheel and trackpad: pinch (ctrl+wheel) and mouse wheel zoom, two-finger scroll pans
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const isTrackpadScroll = !e.ctrlKey && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 40);
      if (isTrackpadScroll) panBy(-e.deltaX, -e.deltaY);
      else zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [panBy, viewportRef, zoomBy]);

  // Drag to pan, two fingers to pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinchDist = useRef(0);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, label, select, textarea, [role=button], [data-no-pan]')) return;
    stop();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, [stop]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 1) {
      moved.current += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
      panBy(next.x - prev.x, next.y - prev.y);
    } else if (pointers.current.size === 2) {
      moved.current += 10;
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = viewportRef.current!.getBoundingClientRect();
      if (pinchDist.current) zoomBy(d / pinchDist.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinchDist.current = d;
    }
  }, [panBy, viewportRef, zoomBy]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = 0;
  }, []);

  /** True right after a drag, so the click that ends a drag doesn't also select a node. */
  const wasDrag = useCallback(() => moved.current > 5, []);

  useEffect(() => stop, [stop]);

  return {
    camera, flyTo, zoomBy, panBy, wasDrag,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
