import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Benchmark, BenchmarkFormData, Task } from '../src/api';

const tasksApi = vi.hoisted(() => ({
  get: vi.fn(),
  abort: vi.fn(),
  resume: vi.fn(),
  delete: vi.fn(),
}));
const benchmarksApi = vi.hoisted(() => ({
  get: vi.fn(),
  getFormData: vi.fn(),
  setGroup: vi.fn(),
}));
const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../src/api', () => ({
  tasksApi,
  benchmarksApi,
  downloadTaskResults: vi.fn(),
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock('../src/context/AuthContext', () => ({ useAuth }));
vi.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('../src/components/PageBreadcrumbs', () => ({ default: () => null }));
vi.mock('../src/components/PageHeader', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../src/components/PageSection', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../src/components/PageTitle', () => ({
  default: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));
vi.mock('../src/components/SubmissionDetails', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../src/components/OwnerReassign', () => ({ default: () => <div>Owner control</div> }));
vi.mock('../src/components/TaskPipeline', () => ({ default: () => <div>Pipeline</div> }));
vi.mock('../src/components/TaskTimer', () => ({ default: () => null }));
vi.mock('../src/components/DeleteSubmissionDialog', () => ({ default: () => null }));

import BenchmarkDetailsPage from '../src/pages/BenchmarkDetailsPage';

const task: Task = {
  id: 10,
  tool: null,
  benchmark: 2,
  category: null,
  category_name: null,
  outcome: 'succeeded',
  execution_backend: 'local_docker',
  current_step: null,
  total_runtime: 10,
  created_at: '2026-09-16T00:00:00Z',
  steps: [],
  name: 'Example benchmark',
  status: 'Done',
  done: true,
  repository: 'https://example.test/benchmark.git',
  hash: 'abc123',
  benchmark_progress: [],
  user_email: 'admin@example.test',
  user_name: 'Admin',
};

const benchmark: Benchmark = {
  id: 2,
  name: 'Example benchmark',
  category: 'default',
  group: 'regular',
  extra: { vnnlib_version: '2.0' },
  published: true,
  instances: [],
  created_at: '2026-09-16T00:00:00Z',
};

const formData: BenchmarkFormData = {
  scheduler_enabled: true,
  can_submit: true,
  execution_backend: 'local_docker',
  uses_categories: false,
  categories: [],
  benchmark_groups: ['default', 'regular', 'extended'],
  benchmark_fields: [],
};

describe('BenchmarkDetailsPage groups', () => {
  beforeEach(() => {
    tasksApi.get.mockReset().mockResolvedValue(task);
    benchmarksApi.get.mockReset().mockResolvedValue(benchmark);
    benchmarksApi.getFormData.mockReset().mockResolvedValue(formData);
    benchmarksApi.setGroup.mockReset().mockImplementation(
      (_id: number, group: string) => Promise.resolve({ ...benchmark, group }),
    );
    useAuth.mockReset().mockReturnValue({ user: { is_admin: true } });
  });

  it('lets an admin assign a group in competition-defined order', async () => {
    render(
      <MemoryRouter initialEntries={['/benchmark/submission/10']}>
        <Routes>
          <Route path="/benchmark/submission/:id" element={<BenchmarkDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const select = await screen.findByRole('combobox', { name: 'Benchmark group' });
    fireEvent.mouseDown(select);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Default', 'Regular', 'Extended',
    ]);

    fireEvent.click(screen.getByRole('option', { name: 'Extended' }));
    await waitFor(() => expect(benchmarksApi.setGroup).toHaveBeenCalledWith(2, 'extended'));
  });
});
