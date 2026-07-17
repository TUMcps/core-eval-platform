import type { ChipProps } from '@mui/material/Chip';

export type Verdict = 'holds' | 'violated' | 'unknown' | 'timeout' | 'error';

/** The buckets a run is summarised in, in reading order. */
export const VERDICTS: Verdict[] = ['holds', 'violated', 'unknown', 'timeout', 'error'];

/**
 * Classify a raw results.csv verdict.
 *
 * This is a submission-health view, not the official scorer's: the scorer buckets an
 * infrastructure failure as `unknown` so the tool simply scores 0 there, whereas here
 * anything that is not a legitimate verification outcome is surfaced as an error, so
 * only a clean run looks clean.
 *
 *   holds / violated / unknown  genuine tool verdicts (shown as unsat / sat / unknown)
 *   timeout                     the tool reached its per-instance budget — expected
 *   error                       everything else the harness emits: no_result_in_file,
 *                               prepare_instance_error_*, prepare_instance_timeout,
 *                               error_exit_code_*, error_nonmaximal, or anything
 *                               unrecognized
 */
export function canonicalVerdict(raw: string): Verdict {
  const r = (raw ?? '').trim().toLowerCase();
  if (r === 'unsat' || r === 'holds') return 'holds';
  if (r === 'sat' || r === 'violated') return 'violated';
  if (r === 'unknown') return 'unknown';
  // Deliberately narrow: prepare_instance_timeout is a prepare-phase fault, not this.
  if (r === 'run_instance_timeout' || r === 'timed-out' || r.startsWith('timeout')) return 'timeout';
  return 'error';
}

/**
 * What each bucket is called on screen. The keys stay in the scorer's vocabulary
 * (its report, and results.csv, say holds/violated), but VNN-COMP speaks vnnlib
 * everywhere else, so that is what we show.
 */
export const VERDICT_LABEL: Record<Verdict, string> = {
  holds: 'unsat',
  violated: 'sat',
  unknown: 'unknown',
  timeout: 'timeout',
  error: 'error',
};

export const VERDICT_COLOR: Record<Verdict, ChipProps['color']> = {
  holds: 'success',
  violated: 'success',  // a found counterexample is a result, not a failure
  unknown: 'warning',
  timeout: 'warning',
  error: 'error',
};

export const resultColor = (result: string): ChipProps['color'] =>
  VERDICT_COLOR[canonicalVerdict(result)];

/** Runtime in seconds, or an em dash when the run reported none. */
export const formatRuntime = (seconds: number | null): string =>
  seconds == null ? '—' : `${seconds.toFixed(2)} s`;
