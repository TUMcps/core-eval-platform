import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import { formatDateTime } from '../utils/datetime';

/** "00h 00m 00s" — fixed width, so a ticking timer doesn't jitter the line. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

/** Per-instance rate, e.g. "15s" or "2m 03s". */
function formatRate(seconds: number): string {
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
}

interface Props {
  startedAt: string | null;
  finishedAt: string | null;
  /** Whether the step is still running — drives the live tick. */
  active: boolean;
  /** Wall-clock cap in hours, or null when this kind is uncapped. */
  timeoutHours?: number | null;
  /** Whether the cap actually fires; an admin can configure one but leave it off. */
  timeoutEnforced?: boolean;
  /** Live run progress for a benchmark step; omitted for kinds that run no instances. */
  progress?: { processed: number; total: number } | null;
}

/**
 * When a step started and how long it has run: ticking once a second while active,
 * frozen at finished − started once it is over. The end time itself is left out —
 * start plus duration says the same thing, and the duration is what gets read.
 */
export default function StepTimer({ startedAt, finishedAt, active, timeoutHours, timeoutEnforced = true, progress }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !startedAt) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [active, startedAt]);

  if (!startedAt) {
    return <Typography variant="caption" color="text.secondary">not started</Typography>;
  }

  const start = new Date(startedAt).getTime();
  // A finished step's duration must come from its recorded end, never the wall clock,
  // which would keep growing after it stopped.
  const end = active || !finishedAt ? now : new Date(finishedAt).getTime();
  const elapsed = (end - start) / 1000;
  const hasCap = !!timeoutHours && timeoutHours > 0;
  const cap = hasCap ? ` / ${timeoutHours}h${timeoutEnforced ? '' : ' (not enforced)'}` : '';

  // "Processed x/N" for benchmark steps; the rate is the wall-clock average per instance
  // run so far (omitted until one has, so it isn't shown as 0s).
  const processed = progress?.processed;
  const rate = processed && processed > 0 ? elapsed / processed : undefined;
  const progressText = progress
    ? ` — Processed ${processed}/${progress.total} instances${rate !== undefined ? ` (~${formatRate(rate)} / instance)` : ''}`
    : '';

  return (
    <Typography variant="caption" color="text.secondary">
      {`${formatDateTime(startedAt)} · ${formatDuration(elapsed)}${cap}${progressText}`}
    </Typography>
  );
}
