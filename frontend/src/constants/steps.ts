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
  vnn_create: 'Create Submission',
  arch_create: 'Create Submission',
  arch_install: 'Install Tool',
  assign: 'Assign Worker',
  vnn_initialize: 'Initialize Worker',
  vnn_clone: 'Clone Repository',
  vnn_install: 'Install Toolkit',
  vnn_post_install: 'Post-Installation Script',
  vnn_restart: 'Restart Worker',
  [PAUSE_KIND]: 'Paused (Waiting to Continue)',
  [LEGACY_PAUSE_KIND]: 'Paused (Waiting to Continue)',
  run_benchmark: 'Run Benchmark',
  vnn_check_results: 'Validate Counterexamples',
  vnn_generate: 'Generate Instances',
  vnn_export: 'Export Results',
  vnn_benchmark_export: 'Export to Benchmarks Repo',
  shutdown: 'Shutdown',
};
