import type { ChipProps } from '@mui/material/Chip';

/**
 * Whether a verdict counts as decided. A decided case reads as success whichever way
 * it went — `sat`/`violated` is a found counterexample, not a failure of the run —
 * while an undecided one is a warning and a crashed one an error.
 */
export function resultColor(result: string): ChipProps['color'] {
  switch (result.trim().toLowerCase()) {
    case 'sat':
    case 'unsat':
    case 'holds':
    case 'violated':
      return 'success';
    case 'timeout':
    case 'unknown':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

/** Runtime in seconds, or an em dash when the run reported none. */
export const formatRuntime = (seconds: number | null): string =>
  seconds == null ? '—' : `${seconds.toFixed(2)} s`;
