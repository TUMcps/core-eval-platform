import { describe, expect, it } from 'vitest';
import { benchmarkStateColor } from '../src/constants/benchmarks';
import { canonicalVerdict, formatRuntime, resultColor } from '../src/constants/results';
import { statusChip, statusGroupRank, stepStatus } from '../src/constants/status';
import { isPauseKind } from '../src/constants/steps';

describe('status helpers', () => {
  it.each([
    ['Done', 'Done', 'success', 'filled'],
    ['Aborted', 'Aborted', 'warning', 'filled'],
    ['Error', 'Error', 'error', 'filled'],
    ['Timed out', 'Timed out', 'error', 'filled'],
    ['Paused', 'Paused', 'primary', 'outlined'],
    ['Waiting', 'Waiting', 'primary', 'outlined'],
    ['Pending', 'Pending', 'default', 'filled'],
    ['unexpected', 'Running', 'primary', 'filled'],
  ])('maps %s to its canonical chip', (state, label, color, variant) => {
    expect(statusChip(state)).toEqual({ label, color, variant });
  });

  it('orders waiting, running, and terminal tasks by group', () => {
    expect(statusGroupRank('Paused')).toBe(0);
    expect(statusGroupRank('Running')).toBe(1);
    expect(statusGroupRank('Done')).toBe(2);
  });

  it('uses terminal failure flags before active flags for a step', () => {
    expect(stepStatus({ error: true, active: true })).toBe('Error');
    expect(stepStatus({ timed_out: true, done: true })).toBe('Timed out');
    expect(stepStatus({ aborted: true, active: true })).toBe('Aborted');
  });

  it('distinguishes paused, waiting, running, and pending steps', () => {
    expect(stepStatus({ paused: true, active: true })).toBe('Paused');
    expect(stepStatus({ waiting: true, active: true })).toBe('Waiting');
    expect(stepStatus({ active: true })).toBe('Running');
    expect(stepStatus({})).toBe('Pending');
  });
});

describe('benchmark and result helpers', () => {
  it.each([
    ['pending', 'default'],
    ['running', 'primary'],
    ['success', 'success'],
    ['error', 'error'],
    ['aborted', 'warning'],
    ['timeout', 'warning'],
  ])('maps benchmark state %s to %s', (state, color) => {
    expect(benchmarkStateColor(state)).toBe(color);
  });

  it.each([
    ['unsat', 'holds'],
    ['HOLDS', 'holds'],
    ['sat', 'violated'],
    ['violated', 'violated'],
    ['unknown', 'unknown'],
    ['run_instance_timeout', 'timeout'],
    ['timeout-30', 'timeout'],
    ['prepare_instance_timeout', 'error'],
    ['unrecognized', 'error'],
  ])('canonicalizes verdict %s as %s', (raw, verdict) => {
    expect(canonicalVerdict(raw)).toBe(verdict);
  });

  it('formats runtime and derives its display color', () => {
    expect(formatRuntime(null)).toBe('—');
    expect(formatRuntime(1.234)).toBe('1.23 s');
    expect(resultColor('sat')).toBe('success');
    expect(resultColor('error_exit_code_1')).toBe('error');
  });
});

describe('step kinds', () => {
  it('recognizes current and legacy pause kinds', () => {
    expect(isPauseKind('pause')).toBe(true);
    expect(isPauseKind('vnn_pause')).toBe(true);
    expect(isPauseKind('run_benchmark')).toBe(false);
  });
});
