/** Core's hold-for-an-operator step kind (core.models.execution.PAUSE_KIND). */
export const PAUSE_KIND = 'pause';
/** The same step on tasks imported from the old system, which predate the core kind. */
export const LEGACY_PAUSE_KIND = 'vnn_pause';

export const isPauseKind = (kind: string) => kind === PAUSE_KIND || kind === LEGACY_PAUSE_KIND;

/** TaskStep.status -> the canonical status label statusChip() understands. */
export const STEP_STATUS: Record<string, string> = {
  pending: 'Pending',
  active: 'Running',
  done: 'Done',
  failed: 'Error',
  aborted: 'Aborted',
};

/**
 * Friendlier step names than the raw kinds, across both submission pipelines.
 * Includes the legacy kinds (vnn_initialize/vnn_clone/vnn_post_install/vnn_restart/
 * vnn_pause) that only appear on imported tasks, so their steps still read properly.
 */
export const KIND_LABEL: Record<string, string> = {
  vnn_create: 'Create submission',
  assign: 'Assign worker',
  vnn_initialize: 'Initialize worker',
  vnn_clone: 'Clone repository',
  vnn_install: 'Install toolkit',
  vnn_post_install: 'Post-installation script',
  vnn_restart: 'Restart worker',
  [PAUSE_KIND]: 'Paused (waiting to continue)',
  [LEGACY_PAUSE_KIND]: 'Paused (waiting to continue)',
  run_benchmark: 'Run benchmark',
  vnn_check_results: 'Validate counterexamples',
  vnn_generate: 'Generate instances',
  vnn_export: 'Export results',
  vnn_benchmark_export: 'Export to benchmarks repo',
  shutdown: 'Shutdown',
};
