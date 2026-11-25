import { useEffect, useRef, useState } from 'react';

/**
 * useCallTimer
 *
 * Tracks elapsed call duration, updating every second while `startedAt` is set.
 *
 * @param startedAt - The Date when the call became active, or null when idle.
 * @returns `{ duration, formattedDuration }` where duration is seconds elapsed
 *          and formattedDuration is a "MM:SS" string.
 */
export function useCallTimer(startedAt: Date | null): {
  duration: number;
  formattedDuration: string;
} {
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing interval whenever startedAt changes
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!startedAt) {
      setDuration(0);
      return;
    }

    // Immediately set the current elapsed time (avoid a 1-second blank)
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      setDuration(elapsed);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startedAt]);

  const formattedDuration = formatDuration(duration);

  return { duration, formattedDuration };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${pad(minutes)}:${pad(secs)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
