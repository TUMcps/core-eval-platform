import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolkitFormData } from '../src/api';

const toolkitApi = vi.hoisted(() => ({
  getFormData: vi.fn(),
  submit: vi.fn(),
}));
const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../src/api', () => ({ toolkitApi }));
vi.mock('../src/context/AuthContext', () => ({ useAuth }));

import ToolkitSubmissionPage from '../src/pages/ToolkitSubmissionPage';

const formData = (overrides: Partial<ToolkitFormData> = {}): ToolkitFormData => ({
  can_submit: true,
  scheduler_enabled: true,
  execution_backend: 'local_docker',
  instance_types: [{ value: 't2.large', label: 'Large', hardware: 'CPU', guidance: 'Testing' }],
  ami_options: [{ value: 'ubuntu:22.04', label: 'Ubuntu' }],
  run_networks_options: [{ value: 'all', label: 'All networks' }],
  benchmark_categories: {
    alpha: {
      label: 'Alpha category',
      benchmarks: [
        { id: 'benchmark-b', name: 'Beta benchmark' },
        { id: 'benchmark-a', name: 'Alpha benchmark' },
      ],
    },
    beta: {
      label: 'Beta category',
      benchmarks: [{ id: 'benchmark-c', name: 'Gamma benchmark' }],
    },
  },
  default_eni: 'eni-default',
  uses_categories: false,
  ...overrides,
});

function Destination() {
  return <div>Destination: {useLocation().pathname}</div>;
}

function renderPage(prefillData?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/toolkit/submit', state: prefillData ? { prefillData } : null }]}>
      <Routes>
        <Route path="/toolkit/submit" element={<ToolkitSubmissionPage />} />
        <Route path="/toolkit/submission/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const submitForm = () => {
  const button = screen.getByRole('button', { name: 'Submit toolkit' });
  const form = button.closest('form');
  if (!form) throw new Error('Toolkit submission form not found');
  fireEvent.submit(form);
};

describe('ToolkitSubmissionPage', () => {
  beforeEach(() => {
    toolkitApi.getFormData.mockReset();
    toolkitApi.submit.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue({ user: null });
    toolkitApi.getFormData.mockResolvedValue(formData());
    toolkitApi.submit.mockResolvedValue({ redirect_to: '123' });
  });

  it('loads defaults, submits the VNN payload, and navigates to the new task', async () => {
    renderPage();

    fireEvent.change(await screen.findByRole('textbox', { name: /Toolkit name/i }), { target: { value: 'My verifier' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Git clone URL/i }), { target: { value: 'https://example.com/verifier.git' } });
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Base Docker image/i })).toHaveValue('ubuntu:22.04'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha benchmark' }));
    submitForm();

    await waitFor(() => expect(toolkitApi.submit).toHaveBeenCalledWith({
      name: 'My verifier',
      repository: 'https://example.com/verifier.git',
      hash: '',
      ami: 'ubuntu:22.04',
      aws_instance_type: 't2.large',
      scripts_dir: '.',
      manual_installation_step: false,
      run_installation_script_as_root: false,
      run_post_installation_script_as_root: false,
      run_toolkit_as_root: false,
      benchmarks: ['benchmark-a'],
      run_networks: 'all',
      use_own_eni: false,
      vnnlib_version: '1.0',
    }));
    expect(await screen.findByText('Destination: /toolkit/submission/123')).toBeInTheDocument();
  });

  it('uses prefilled category data and omits the VNN-only field', async () => {
    toolkitApi.getFormData.mockResolvedValue(formData({ uses_categories: true }));
    renderPage({
      name: 'ARCH tool',
      repository: 'https://example.com/arch.git',
      hash: 'abc123',
      scripts_dir: 'scripts',
      benchmarks: ['benchmark-c'],
    });

    expect(await screen.findByRole('combobox', { name: /Category/i })).toHaveTextContent('Beta category');
    expect(screen.getByRole('checkbox', { name: 'Gamma benchmark' })).toBeChecked();
    expect(screen.queryByRole('combobox', { name: /Preferred VNNLIB version/i })).not.toBeInTheDocument();
    submitForm();

    await waitFor(() => expect(toolkitApi.submit).toHaveBeenCalledOnce());
    const payload = toolkitApi.submit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: 'ARCH tool',
      repository: 'https://example.com/arch.git',
      hash: 'abc123',
      scripts_dir: 'scripts',
      benchmarks: ['benchmark-c'],
    });
    expect(payload).not.toHaveProperty('vnnlib_version');
  });

  it('includes enabled admin-only options in the payload', async () => {
    useAuth.mockReturnValue({ user: { is_admin: true } });
    renderPage({
      name: 'Admin tool',
      repository: 'https://example.com/admin.git',
      reverse_order: true,
      split: 4,
      export_results: true,
      force_pause: true,
      local_execution: true,
    });

    await screen.findByText('Admin Options');
    submitForm();

    await waitFor(() => expect(toolkitApi.submit).toHaveBeenCalledOnce());
    expect(toolkitApi.submit.mock.calls[0][0]).toMatchObject({
      reverse_order: true,
      split: 4,
      export_results: true,
      force_pause: true,
      local_execution: true,
    });
  });

  it('disables submission and shows warnings when submissions are unavailable', async () => {
    toolkitApi.getFormData.mockResolvedValue(formData({ can_submit: false, scheduler_enabled: false }));
    renderPage();

    expect(await screen.findByText('Submission is currently closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit toolkit' })).toBeDisabled();
    expect(toolkitApi.submit).not.toHaveBeenCalled();
  });

  it('shows structured backend validation errors', async () => {
    toolkitApi.submit.mockRejectedValue({
      response: { data: { errors: { repository: ['Invalid URL'], benchmarks: ['Select at least one'] } } },
    });
    renderPage({ name: 'Broken tool', repository: 'invalid' });
    await screen.findByRole('textbox', { name: /Base Docker image/i });
    submitForm();

    expect(await screen.findByText(/repository: Invalid URL benchmarks: Select at least one/)).toBeInTheDocument();
  });
});
