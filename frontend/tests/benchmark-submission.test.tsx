import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BenchmarkFormData } from '../src/api';

const benchmarksApi = vi.hoisted(() => ({
  getFormData: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('../src/api', () => ({ benchmarksApi }));

import BenchmarkSubmissionPage from '../src/pages/BenchmarkSubmissionPage';

const formData = (overrides: Partial<BenchmarkFormData> = {}): BenchmarkFormData => ({
  scheduler_enabled: true,
  can_submit: true,
  execution_backend: 'local_docker',
  uses_categories: false,
  categories: [
    { id: 'acasxu', name: 'ACAS Xu' },
    { id: 'cifar', name: 'CIFAR' },
  ],
  benchmark_fields: [
    { name: 'vnnlib_version', type: 'select', options: ['2.0', '1.0'] },
    { name: 'seed', type: 'text' },
  ],
  ...overrides,
});

function Destination() {
  return <div>Destination: {useLocation().pathname}</div>;
}

function renderPage(prefillData?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/benchmark/submit', state: prefillData ? { prefillData } : null }]}>
      <Routes>
        <Route path="/benchmark/submit" element={<BenchmarkSubmissionPage />} />
        <Route path="/benchmark/submission/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const submitForm = () => {
  const button = screen.getByRole('button', { name: 'Submit benchmark' });
  const form = button.closest('form');
  if (!form) throw new Error('Benchmark submission form not found');
  fireEvent.submit(form);
};

describe('BenchmarkSubmissionPage', () => {
  beforeEach(() => {
    benchmarksApi.getFormData.mockReset();
    benchmarksApi.submit.mockReset();
    benchmarksApi.getFormData.mockResolvedValue(formData());
    benchmarksApi.submit.mockResolvedValue({ redirect_to: '456' });
  });

  it('loads dynamic fields, submits the VNN payload, and navigates', async () => {
    renderPage();

    fireEvent.change(await screen.findByRole('textbox', { name: /Benchmark name/i }), { target: { value: 'New benchmark' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Git repository URL/i }), { target: { value: 'https://example.com/benchmark.git' } });
    fireEvent.change(screen.getByLabelText('Commit hash (optional)'), { target: { value: 'deadbeef' } });
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '42' } });
    expect(screen.getByRole('combobox', { name: /Vnnlib Version/i })).toHaveTextContent('2.0');
    submitForm();

    await waitFor(() => expect(benchmarksApi.submit).toHaveBeenCalledWith({
      repository: 'https://example.com/benchmark.git',
      hash: 'deadbeef',
      vnnlib_version: '2.0',
      seed: '42',
      name: 'New benchmark',
    }));
    expect(await screen.findByText('Destination: /benchmark/submission/456')).toBeInTheDocument();
  });

  it('submits category mode without a benchmark name', async () => {
    benchmarksApi.getFormData.mockResolvedValue(formData({ uses_categories: true }));
    renderPage({
      category: 'cifar',
      repository: 'https://example.com/category.git',
      hash: 'abc123',
      fields: { vnnlib_version: '1.0', seed: '7' },
    });

    expect(await screen.findByRole('combobox', { name: /Category/i })).toHaveTextContent('CIFAR');
    expect(screen.queryByRole('textbox', { name: /Benchmark name/i })).not.toBeInTheDocument();
    submitForm();

    await waitFor(() => expect(benchmarksApi.submit).toHaveBeenCalledWith({
      repository: 'https://example.com/category.git',
      hash: 'abc123',
      vnnlib_version: '1.0',
      seed: '7',
      category: 'cifar',
    }));
  });

  it('imports benchmark metadata from data.json', async () => {
    const { container } = renderPage();
    await screen.findByRole('textbox', { name: /Benchmark name/i });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('File input not found');
    const file = new File(['ignored'], 'data.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify({
        name: 'Imported benchmark',
        repository: 'https://example.com/imported.git',
        hash: 'feedface',
        seed: '99',
      })),
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Imported data.json successfully.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Benchmark name/i })).toHaveValue('Imported benchmark');
    expect(screen.getByRole('textbox', { name: /Git repository URL/i })).toHaveValue('https://example.com/imported.git');
    expect(screen.getByLabelText('Commit hash (optional)')).toHaveValue('feedface');
  });

  it('reports invalid imported JSON without changing the form', async () => {
    const { container } = renderPage();
    const nameInput = await screen.findByRole('textbox', { name: /Benchmark name/i });
    fireEvent.change(nameInput, { target: { value: 'Existing name' } });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('File input not found');
    const file = new File(['ignored'], 'broken.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('{invalid') });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('The file is not valid JSON.')).toBeInTheDocument();
    expect(nameInput).toHaveValue('Existing name');
  });

  it('displays backend submission errors', async () => {
    benchmarksApi.submit.mockRejectedValue({ response: { data: 'Repository could not be cloned' } });
    renderPage({ name: 'Broken benchmark', repository: 'https://example.com/missing.git' });
    await screen.findByLabelText('Seed');
    submitForm();

    expect(await screen.findByText('Repository could not be cloned')).toBeInTheDocument();
  });
});
