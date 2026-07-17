import type { ChipProps } from '@mui/material/Chip';

/**
 * Whether a verdict counts as decided. A decided case reads as success whichever way
 * it went — `sat`/`violated` is a found counterexample, not a failure of the run —
 * while an undecided one is a warning and a crashed one an error.
 */
export function resultColor(result: string): ChipProps['color'] {
  const r = result.trim().toLowerCase();
  if (['sat', 'unsat', 'holds', 'violated'].includes(r)) return 'success';
  if (r === 'unknown') return 'warning';
  // The harness's per-instance budget: expected, not a fault.
  if (r === 'run_instance_timeout' || r === 'timed-out' || r.startsWith('timeout')) return 'warning';
  // Everything else the harness emits is an infrastructure failure:
  // no_result_in_file, prepare_instance_*, error_exit_code_*, error_nonmaximal.
  return 'error';
}

/** Runtime in seconds, or an em dash when the run reported none. */
export const formatRuntime = (seconds: number | null): string =>
  seconds == null ? '—' : `${seconds.toFixed(2)} s`;
