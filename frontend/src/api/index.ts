import apiClient from './client';

// Task/Benchmark/Tool use integer ids; callers also pass useParams() strings.
type ID = number | string;

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
  worker_service_url?: string;
  worker_service_port?: number | null;
  execution_backend?: string;
}

export interface Category { id: string; name: string; result_fields: string[]; spec: Record<string, unknown>; }
export interface Tool { id: number; name: string; category: string; repository: string; hash: string; base_image: string; script_dir: string; extra: Record<string, unknown>; published: boolean; created_at: string; }
export interface Instance { id: string; name: string; }
export interface Benchmark { id: number; name: string; category: string; extra: Record<string, unknown>; published: boolean; instances: Instance[]; created_at: string; }
export interface TaskStep {
  id: string; kind: string; order: number; status: string; started_at: string | null;
  finished_at: string | null; logs: string; has_logs: boolean;
  /** True once this step has exported artifacts to download (the backend decides which do). */
  can_download_results: boolean;
  /** True only for the running benchmark step — drives the per-stage "Abort benchmark" button. */
  can_abort_benchmark: boolean;
  /** The raw results file this step's run produced; empty for steps that make none. */
  results: string;
  /** A step's frozen outcome, for steps that compute one (a scoring step's report). */
  summary: StepSummary | null;
  /** Live run progress while a benchmark's instances execute; null until the first lands. */
  progress: { processed: number; total: number } | null;
  /** Wall-clock cap this step runs under, in hours; null for the uncapped kinds. */
  timeout_hours: number | null;
  /** Whether caps actually fire — an admin can configure one but leave it off. */
  timeout_enforced: boolean;
}

/** A frozen report on one benchmark run — either the VNN scorer's, or a variant's own tally. */
export interface StepSummary {
  summary: {
    instances: number;
    /** Verdict → count. VNN uses holds/violated/…; other variants define their own buckets. */
    verdicts: Record<string, number>;
    /** valid / valid_with_tolerance / invalid / missing — only when a scorer validated witnesses. */
    witnesses?: Record<string, number>;
    /** Preferred display order for `verdicts` keys (variants without witness validation). */
    order?: string[];
  };
  severity: 'success' | 'error' | 'unknown';
}
export interface BenchmarkProgress { name: string; state: string; step_id: number; }
export interface Task {
  id: number; tool: number | null; benchmark: number | null; category: string | null;
  category_name: string | null; outcome: string;
  execution_backend: string; current_step: string | null; total_runtime: number | null; created_at: string;
  steps: TaskStep[]; name: string; status: string; done: boolean; repository: string; hash: string;
  benchmark_progress: BenchmarkProgress[]; user_email: string | null; user_name: string | null;
}
export interface FormOption { value: string; label: string; hardware?: string; guidance?: string; }
export interface ToolkitFormData {
  can_submit: boolean; scheduler_enabled: boolean; execution_backend: string;
  instance_types: FormOption[]; ami_options: FormOption[]; run_networks_options: FormOption[];
  benchmark_categories: Record<string, { label: string; benchmarks: { id: string; name: string }[] }>;
  default_eni: string; uses_categories: boolean;
}
export interface Track { id: string; name: string; description: string; benchmarks: number[]; created_at: string; }
export interface FieldSpec { name: string; type: string; options?: string[]; }
export interface Branding { primary_color: string; hero_image: string; hero_max_width: number; favicon: string; navbar_gradient?: string; accent_color?: string; }
export interface LandingLink { label: string; url: string; }
export interface Related { text?: string; label?: string; url?: string; }
export interface Landing { tagline: string; links: LandingLink[]; contacts: string[]; related: Related; }

/** One step of a guide's pipeline: a box in the strip, and a card explaining it. */
export interface GuideStep { title: string; details: string[]; }
/** A chunk of guide prose. `text`/`note` carry `text`, `code` carries `code`, `bullets` carries `items`. */
export interface GuideBlock { type: 'text' | 'note' | 'code' | 'bullets'; text?: string; code?: string; items?: string[]; }
export interface GuideSection { heading: string; blocks: GuideBlock[]; }
/** A how-to page's copy, written by the active competition (see results.py Guide). */
export interface Guide { intro: string; pipeline: GuideStep[]; sections: GuideSection[]; }

export interface CompetitionInfo { name: string; display_name: string; presentation: { result_columns: string[]; submission_fields: FieldSpec[]; score_columns: string[]; branding: Branding; landing: Landing; guides?: Record<string, Guide>; } | null; }
export interface Scoreboard { columns: string[]; rows: Record<string, unknown>[]; }

const results = <T,>(url: string) => apiClient.get<{ results?: T[] } | T[]>(url).then((r) => {
  const d = r.data as any;
  return (d.results ?? d) as T[];
});

/** One page of a paginated (DRF) list endpoint. */
export interface Page<T> { count: number; results: T[]; }
const page = <T,>(url: string) => apiClient.get<Page<T>>(url).then((r) => r.data);

export const authApi = {
  getCurrentUser: () => apiClient.get<User | null>('/api/auth/me/').then((r) => r.data),
  login: (email: string, password: string) => apiClient.post<User>('/api/auth/login/', { email, password }).then((r) => r.data),
  signup: (name: string, email: string, password: string) => apiClient.post<User>('/api/auth/signup/', { name, email, password }).then((r) => r.data),
  logout: () => apiClient.post('/api/auth/logout/'),
  updateProfile: (data: { name?: string; email?: string; worker_service_url?: string; worker_service_port?: number | null }) => apiClient.patch<User>('/api/auth/profile/', data).then((r) => r.data),
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
  get: (id: ID) => apiClient.get<Tool>(`/api/tools/${id}/`).then((r) => r.data),
  create: (data: Partial<Tool>) => apiClient.post<Tool>('/api/tools/', data).then((r) => r.data),
  run: (id: ID) => apiClient.post<Task>(`/api/tools/${id}/run/`).then((r) => r.data),
};

export interface Result {
  id: string;
  task: number;
  tool: number;
  benchmark: string;
  benchmark_name: string | null;
  /** Null on a run from before the benchmark's instances were recorded. */
  instance: string | null;
  instance_name: string | null;
  result: string;
  /** Seconds. */
  time: number | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export const resultsApi = {
  // Comes back in run order: by benchmark, then the instance's own order.
  forTask: (task: ID) => results<Result>(`/api/results/?task=${task}`),
};

export interface BenchmarkFormData {
  scheduler_enabled: boolean; can_submit: boolean; execution_backend: string;
  uses_categories: boolean; categories: { id: string; name: string }[];
  benchmark_fields: FieldSpec[];
}

export const benchmarksApi = {
  list: () => results<Benchmark>('/api/benchmarks/'),
  get: (id: ID) => apiClient.get<Benchmark>(`/api/benchmarks/${id}/`).then((r) => r.data),
  create: (data: Partial<Benchmark>) => apiClient.post<Benchmark>('/api/benchmarks/', data).then((r) => r.data),
  submit: (data: Record<string, unknown>) => apiClient.post<{ redirect_to: string }>('/api/benchmark/submit/', data).then((r) => r.data),
  getFormData: () => apiClient.get<BenchmarkFormData>('/api/benchmark/form_data/').then((r) => r.data),
  addInstances: (id: ID, names: string[]) =>
    apiClient.post(`/api/benchmarks/${id}/add_instances/`, names.map((name, order) => ({ name, order }))).then((r) => r.data),
};

export const usersApi = {
  list: () => results<User>('/api/users/'),
  update: (id: string, data: Partial<User>) => apiClient.patch<User>(`/api/users/${id}/`, data).then((r) => r.data),
};

export const tasksApi = {
  list: (type?: 'tool' | 'benchmark') => results<Task>(`/api/tasks/${type ? `?type=${type}` : ''}`),
  get: (id: ID) => apiClient.get<Task>(`/api/tasks/${id}/`).then((r) => r.data),
  abort: (id: ID) => apiClient.post<Task>(`/api/tasks/${id}/abort/`).then((r) => r.data),
  // Abort just the running benchmark; the rest of the submission continues.
  abortBenchmark: (id: ID) => apiClient.post<Task>(`/api/tasks/${id}/abort-benchmark/`).then((r) => r.data),
  resume: (id: ID) => apiClient.post<Task>(`/api/tasks/${id}/resume/`).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/api/tasks/${id}/`).then((r) => r.data),
  changeOwner: (id: ID, owner: string) => apiClient.post<Task>(`/api/tasks/${id}/change_owner/`, { owner }).then((r) => r.data),
  // An export step's results.csv + counterexamples, zipped. `step` is the step's order.
  resultsArchive: (id: ID, step: number) =>
    apiClient.get<Blob>(`/api/tasks/${id}/results-archive/?step=${step}`, { responseType: 'blob' })
      .then((r) => r.data),
};

/** A page of task rows for the overview tables (server paginates/sorts/searches). */
export const taskPage = (opts: { type: 'tool' | 'benchmark'; page: number; pageSize: number; search?: string }) =>
  page<Task>(`/api/tasks/?type=${opts.type}&page=${opts.page}&page_size=${opts.pageSize}`
    + (opts.search ? `&search=${encodeURIComponent(opts.search)}` : ''));

// Toolkit submissions are tool-run tasks; their lifecycle lives on tasksApi.
export const toolkitApi = {
  getList: () => results<Task>('/api/tasks/?type=tool'),
  getFormData: () => apiClient.get<ToolkitFormData>('/api/toolkit/form_data/').then((r) => r.data),
  submit: (data: Record<string, unknown>) => apiClient.post<{ redirect_to: string }>('/api/toolkit/submit/', data).then((r) => r.data),
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
