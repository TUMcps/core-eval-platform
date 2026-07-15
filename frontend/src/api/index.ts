import apiClient from './client';

export interface User {
  id: string;
  email: string;
  role: string;
  enabled: boolean;
  is_admin: boolean;
  is_organizer: boolean;
}

export interface Category { id: string; name: string; result_fields: string[]; spec: Record<string, unknown>; }
export interface Tool { id: string; name: string; category: string; repository: string; base_image: string; extra: Record<string, unknown>; published: boolean; created_at: string; }
export interface Instance { id: string; name: string; }
export interface Benchmark { id: string; name: string; category: string; published: boolean; instances: Instance[]; created_at: string; }
export interface TaskStep { id: string; kind: string; order: number; status: string; started_at: string | null; finished_at: string | null; }
export interface Task { id: string; tool: string | null; benchmark: string | null; outcome: string; current_step: string | null; total_runtime: number | null; created_at: string; steps: TaskStep[]; }
export interface Track { id: string; name: string; description: string; benchmarks: string[]; created_at: string; }
export interface FieldSpec { name: string; type: string; options?: string[]; }
export interface CompetitionInfo { name: string; display_name: string; presentation: { result_columns: string[]; submission_fields: FieldSpec[]; score_columns: string[]; } | null; }
export interface Scoreboard { columns: string[]; rows: Record<string, unknown>[]; }

const results = <T,>(url: string) => apiClient.get<{ results?: T[] } | T[]>(url).then((r) => {
  const d = r.data as any;
  return (d.results ?? d) as T[];
});

export const authApi = {
  getCurrentUser: () => apiClient.get<User | null>('/api/auth/me/').then((r) => r.data),
  login: (email: string, password: string) => apiClient.post<User>('/api/auth/login/', { email, password }).then((r) => r.data),
  signup: (email: string, password: string) => apiClient.post<User>('/api/auth/signup/', { email, password }).then((r) => r.data),
  logout: () => apiClient.post('/api/auth/logout/'),
};

export const competitionApi = {
  info: () => apiClient.get<CompetitionInfo>('/api/competition/').then((r) => r.data),
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

export const benchmarksApi = {
  list: () => results<Benchmark>('/api/benchmarks/'),
  create: (data: Partial<Benchmark>) => apiClient.post<Benchmark>('/api/benchmarks/', data).then((r) => r.data),
  addInstances: (id: string, names: string[]) =>
    apiClient.post(`/api/benchmarks/${id}/add_instances/`, names.map((name, order) => ({ name, order }))).then((r) => r.data),
  publish: (id: string) => apiClient.post<Benchmark>(`/api/benchmarks/${id}/publish/`).then((r) => r.data),
};

export const tasksApi = {
  list: () => results<Task>('/api/tasks/'),
  get: (id: string) => apiClient.get<Task>(`/api/tasks/${id}/`).then((r) => r.data),
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
