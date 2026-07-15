import type { ChipProps } from '@mui/material/Chip';

export type StatusColor = ChipProps['color'];
export type StatusVariant = ChipProps['variant'];

/**
 * Canonical status label + chip color/variant, shared by the overview tables and
 * the detail pages so the two never disagree. Colors map to the soft chip palette
 * in theme.ts:
 *   Running   -> blue filled  (covers "active" / "in progress")
 *   Done      -> green
 *   Aborted   -> yellow
 *   Error     -> red
 *   Timed out -> red
 *   Paused    -> blue outlined (same blue as Running, outline distinguishes the two)
 *   Waiting   -> blue outlined (queued for a free instance/ENI; styled like Paused)
 *   Pending   -> grey
 */
export function statusChip(state: string): {
  label: string;
  color: StatusColor;
  variant: StatusVariant;
} {
  switch (state) {
    case 'Done':
      return { label: 'Done', color: 'success', variant: 'filled' };
    case 'Aborted':
      return { label: 'Aborted', color: 'warning', variant: 'filled' };
    case 'Error':
      return { label: 'Error', color: 'error', variant: 'filled' };
    case 'Timed out':
      return { label: 'Timed out', color: 'error', variant: 'filled' };
    case 'Paused':
      // Pause is just a held Running, so it keeps the same blue but uses the
      // outline variant so it reads as clearly distinct from Running.
      return { label: 'Paused', color: 'primary', variant: 'outlined' };
    case 'Waiting':
      // Queued for a free instance/ENI: like Paused, it's a held-but-not-failed
      // state, so it shares the outlined-blue treatment.
      return { label: 'Waiting', color: 'primary', variant: 'outlined' };
    case 'Pending':
      return { label: 'Pending', color: 'default', variant: 'filled' };
    case 'Running':
    default:
      return { label: 'Running', color: 'primary', variant: 'filled' };
  }
}

/**
 * Overview ordering group for a task's status: waiting-type states first, then
 * still-running, then finished. A stable sort by this rank keeps the caller's
 * existing within-group order (newest first).
 *   0 -> Waiting / Paused / Pending (queued, held, or not yet started)
 *   1 -> Running
 *   2 -> Done / Aborted / Error / Timed out (finished)
 */
export function statusGroupRank(state: string): number {
  switch (state) {
    case 'Done':
    case 'Aborted':
    case 'Error':
    case 'Timed out':
      return 2;
    case 'Running':
      return 1;
    default:
      return 0;
  }
}

/** Derive the canonical status string for a single task step from its flags. */
export function stepStatus(step: {
  error?: boolean;
  timed_out?: boolean;
  aborted?: boolean;
  done?: boolean;
  active?: boolean;
  waiting?: boolean;
  paused?: boolean;
}): string {
  // `error` / `timed_out` are set by the backend on the terminal step that drove the
  // whole task's status, so the worst outcome surfaces on a real stage (and the stage
  // chip matches the overall status shown at the top of the page / in the overview).
  if (step.error) return 'Error';
  if (step.timed_out) return 'Timed out';
  if (step.aborted) return 'Aborted';
  if (step.done) return 'Done';
  // A held pause stage is active but waiting for the user to continue; surface it as
  // Paused (matching the overall task status) before the generic Running.
  if (step.paused) return 'Paused';
  // `waiting` (active instance-creation step queued for a free slot/ENI) is reported
  // alongside active; surface it before the generic Running so the queue state is visible.
  if (step.waiting) return 'Waiting';
  if (step.active) return 'Running';
  return 'Pending';
}
