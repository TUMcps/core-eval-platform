import type { StatusColor } from './status';

/**
 * Single source of truth for how a benchmark is named and colored across the app, so the
 * toolkit overview and the details page never drift apart. Backend counterpart:
 * `benchmark_progress` entries in `toolkit_list_api` (state) and `benchmark_track`.
 */

/** Coarse per-benchmark progress state reported by the backend (`benchmark_progress`). */
export type BenchmarkState =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'aborted'
  | 'timeout';

/**
 * Chip color for a per-benchmark progress state, so a submission's benchmark list reads
 * like a progress bar: grey (not started) -> blue (running) -> green / red / orange
 * (completed OK / error / aborted-or-timeout).
 */
export function benchmarkStateColor(state: string): StatusColor {
  switch (state) {
    case 'success':
      return 'success'; // green: completed cleanly
    case 'error':
      return 'error'; // red: completed with errors
    case 'aborted':
    case 'timeout':
      return 'warning'; // orange: aborted or timed out
    case 'running':
      return 'primary'; // blue (soft chip palette): currently running
    case 'pending':
    default:
      return 'default'; // grey: not reached yet
  }
}

/** Legend entries for the overview, ordered as a submission progresses. */
export const BENCHMARK_STATE_LEGEND: { state: BenchmarkState; label: string }[] = [
  { state: 'pending', label: 'pending' },
  { state: 'running', label: 'running' },
  { state: 'success', label: 'success' },
  { state: 'error', label: 'error' },
  { state: 'aborted', label: 'aborted / timeout' },
];

/**
 * Track display labels, shared by the details-page section headers and the overview.
 * Keys match the backend `benchmark_track` values ('test' / 'regular' / 'extended').
 */
export const TRACK_LABELS: Record<string, string> = {
  test: 'Test Benchmark',
  regular: 'Regular Track',
  extended: 'Extended Track',
};
