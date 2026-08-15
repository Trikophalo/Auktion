import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/game';

/** Tweens a number so money and scores always count instead of snapping. */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(origin + delta * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, durationMs]);

  return display;
}

/**
 * Milliseconds remaining until an absolute server deadline, measured on the
 * server's clock - a client whose clock is off would otherwise see a countdown
 * that disagrees with everyone else's.
 */
export function useCountdown(deadline: number | null): number {
  const offset = useGame((s) => s.clockOffset);
  const [remaining, setRemaining] = useState(() => (deadline ? Math.max(0, deadline - Date.now() - offset) : 0));

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, deadline - (Date.now() + offset)));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [deadline, offset]);

  return remaining;
}

/** Drives the reveal: pixel level 1 -> 0 in discrete, punchy steps. */
export function usePixelReveal(active: boolean, durationMs: number, steps = 7): number {
  const [level, setLevel] = useState(active ? 1 : 0);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    setLevel(1);
    const interval = durationMs / steps;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setLevel(Math.max(0, 1 - step / steps));
      if (step >= steps) clearInterval(id);
    }, interval);
    return () => clearInterval(id);
  }, [active, durationMs, steps]);

  return level;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
