export interface GroupedBenchmark<T> {
  label: string;
  benchmarks: T[];
}

/** Human-readable label for a canonical benchmark-group key. */
export const formatBenchmarkGroup = (group: string) =>
  group ? `${group[0].toUpperCase()}${group.slice(1)}` : group;

/** Partition benchmarks in the competition's configured order. */
export function groupBenchmarks<T extends { name: string; group?: string }>(
  benchmarks: T[],
  order: string[],
): GroupedBenchmark<T>[] {
  const sorted = [...benchmarks].sort((a, b) => a.name.localeCompare(b.name));
  if (!order.length) return [{ label: '', benchmarks: sorted }];
  const declared = order
    .map((label) => ({ label, benchmarks: sorted.filter((b) => (b.group || 'default') === label) }))
    .filter((group) => group.benchmarks.length > 0);
  const unknown = sorted.filter((b) => !order.includes(b.group || 'default'));
  return unknown.length ? [...declared, { label: 'Other', benchmarks: unknown }] : declared;
}

/** The single implicit default group should not add visual noise. */
export const showGroupLabels = (order: string[]) =>
  order.length > 1 || (order.length === 1 && order[0] !== 'default');
