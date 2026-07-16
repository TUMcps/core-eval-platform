import apiClient from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  enabled: boolean;
  is_admin: boolean;
  is_organizer: boolean;
  created_at: string;
  aws_eni?: string;
  aws_mac?: string;
  execution_backend?: string;
}

export interface Category { id: string; name: string; result_fields: string[]; spec: Record<string, unknown>; }
export interface Tool { id: string; name: string; category: string; repository: string; base_image: string; extra: Record<string, unknown>; published: boolean; created_at: string; }
export interface Instance { id: string; name: string; }
export interface Benchmark { id: string; name: string; category: string; extra: Record<string, unknown>; published: boolean; instances: Instance[]; created_at: string; }
export interface TaskStep { id: string; kind: string; order: number; status: string; started_at: string | null; finished_at: string | null; logs: string; has_logs: boolean; }
export interface BenchmarkProgress { name: string; state: string; step_id: number; }
export interface Task {
  id: string; number: number; tool: string | null; benchmark: string | null; outcome: string;
  current_step: string | null; total_runtime: number | null; created_at: string;
  steps: TaskStep[]; name: string; status: string; done: boolean;
  benchmark_progress: BenchmarkProgress[]; user_email: string | null; user_name: string | null;
}
export interface FormOption { value: string; label: string; hardware?: string; guidance?: string; }
export interface ToolkitFormData {
  can_submit: boolean; scheduler_enabled: boolean; execution_backend: string;
  instance_types: FormOption[]; ami_options: FormOption[]; run_networks_options: FormOption[];
  benchmark_categories: Record<string, { label: string; benchmarks: { id: string; name: string }[] }>;
  default_eni: string;
}
export interface Track { id: string; name: string; description: string; benchmarks: string[]; created_at: string; }
export interface FieldSpec { name: string; type: string; options?: string[]; }
export interface Branding { primary_color: string; hero_image: string; favicon: string; }
export interface LandingLink { label: string; url: string; }
export interface Related { text?: string; label?: string; url?: string; }
export interface Landing { tagline: string; links: LandingLink[]; contacts: string[]; related: Related; }
export interface CompetitionInfo { name: string; display_name: string; presentation: { result_columns: string[]; submission_fields: FieldSpec[]; score_columns: string[]; branding: Branding; landing: Landing; } | null; }
export interface Scoreboard { columns: string[]; rows: Record<string, unknown>[]; }

const results = <T,>(url: string) => apiClient.get<{ results?: T[] } | T[]>(url).then((r) => {
  const d = r.data as any;
  return (d.results ?? d) as T[];
});

export const authApi = {
  getCurrentUser: () => apiClient.get<User | null>('/api/auth/me/').then((r) => r.data),
  login: (email: string, password: string) => apiClient.post<User>('/api/auth/login/', { email, password }).then((r) => r.data),
  signup: (name: string, email: string, password: string) => apiClient.post<User>('/api/auth/signup/', { name, email, password }).then((r) => r.data),
  logout: () => apiClient.post('/api/auth/logout/'),
  updateProfile: (name: string) => apiClient.patch<User>('/api/auth/profile/', { name }).then((r) => r.data),
};

// Seed from the payload the Vite plugin injected into <head> (window.__COMPETITION__),
// so the first render already has it with no network round-trip. Falls back to fetching.
let _infoCache: Promise<CompetitionInfo> | null =
  typeof window !== 'undefined' && window.__COMPETITION__ ? Promise.resolve(window.__COMPETITION__) : null;
export const competitionApi = {
  info: () => apiClient.get<CompetitionInfo>('/api/competition/').then((r) => r.data),
  // Shared across the shell (theme, favicon, titles) — resolved once per load.
  cached: () => (_infoCache ??= competitionApi.info()),
};

export const categoriesApi = {
  list: () => results<Category>('/api/categories/'),
  create: (name: string) => apiClient.post<Category>('/api/categories/', { name }).then((r) => r.data),
};

export const toolsApi = {
  list: () => results<Tool>('/api/tools/'),
  create: (data: Partial<Tool>) => apiClient.post<Tool>('/api/tools/', data).then((r) => r.data),
  run: (id: string) => apiClient.post<Task>(`/api/tools/${id}/run/`).then((r) => r.data),
};

export interface BenchmarkFormData {
  scheduler_enabled: boolean; can_submit: boolean;
  uses_categories: boolean; categories: { id: string; name: string }[];
  benchmark_fields: FieldSpec[];
}

export const benchmarksApi = {
  list: () => results<Benchmark>('/api/benchmarks/'),
  get: (id: string) => apiClient.get<Benchmark>(`/api/benchmarks/${id}/`).then((r) => r.data),
  create: (data: Partial<Benchmark>) => apiClient.post<Benchmark>('/api/benchmarks/', data).then((r) => r.data),
  submit: (data: Record<string, unknown>) => apiClient.post<{ redirect_to: string }>('/api/benchmark/submit/', data).then((r) => r.data),
  getFormData: () => apiClient.get<BenchmarkFormData>('/api/benchmark/form_data/').then((r) => r.data),
  addInstances: (id: string, names: string[]) =>
    apiClient.post(`/api/benchmarks/${id}/add_instances/`, names.map((name, order) => ({ name, order }))).then((r) => r.data),
  publish: (id: string) => apiClient.post<Benchmark>(`/api/benchmarks/${id}/publish/`).then((r) => r.data),
};

export const usersApi = {
  list: () => results<User>('/api/users/'),
  update: (id: string, data: Partial<User>) => apiClient.patch<User>(`/api/users/${id}/`, data).then((r) => r.data),
};

export const tasksApi = {
  list: () => results<Task>('/api/tasks/'),
  get: (id: string) => apiClient.get<Task>(`/api/tasks/${id}/`).then((r) => r.data),
  abort: (id: string) => apiClient.post<Task>(`/api/tasks/${id}/abort/`).then((r) => r.data),
  resume: (id: string) => apiClient.post<Task>(`/api/tasks/${id}/resume/`).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/api/tasks/${id}/`).then((r) => r.data),
};

export const toolkitApi = {
  // Toolkit submissions are tool-run tasks.
  getList: () => results<Task>('/api/tasks/').then((ts) => ts.filter((t) => t.tool)),
  getFormData: () => apiClient.get<ToolkitFormData>('/api/toolkit/form_data/').then((r) => r.data),
  submit: (data: Record<string, unknown>) => apiClient.post<{ redirect_to: string }>('/api/toolkit/submit/', data).then((r) => r.data),
  get: (id: string) => apiClient.get<Task>(`/api/tasks/${id}/`).then((r) => r.data),
  abort: (id: string) => apiClient.post<Task>(`/api/tasks/${id}/abort/`).then((r) => r.data),
  resume: (id: string) => apiClient.post<Task>(`/api/tasks/${id}/resume/`).then((r) => r.data),
};

export const tracksApi = {
  list: () => results<Track>('/api/tracks/'),
  create: (name: string) => apiClient.post<Track>('/api/tracks/', { name }).then((r) => r.data),
  scoreboard: (id: string) => apiClient.get<Scoreboard>(`/api/tracks/${id}/scoreboard/`).then((r) => r.data),
};

export const settingsApi = {
  get: () => apiClient.get<Record<string, unknown>>('/api/settings/').then((r) => r.data),
  patch: (data: Record<string, unknown>) => apiClient.patch<Record<string, unknown>>('/api/settings/', data).then((r) => r.data),
};
