import { useState, useEffect, useRef } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiErrorData, benchmarksApi } from '../api';
import type { BenchmarkFormData } from '../api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import MuiLink from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';

// Turn a field name (e.g. vnnlib_version) into a readable label.
const labelFor = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type ImportNotice = {
  severity: 'success' | 'error';
  text: string;
};

interface BenchmarkPrefill {
  name?: string;
  category?: string;
  repository?: string;
  hash?: string;
  fields?: Record<string, string>;
}

function parseDataJson(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The file must contain a JSON object.');
  }

  const data = parsed as Record<string, unknown>;
  for (const field of ['name', 'repository', 'hash', 'seed']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      throw new Error(`The file is missing the required "${field}" field.`);
    }
  }

  const typed = data as Record<'name' | 'repository' | 'hash' | 'seed', string>;

  return {
    name: typed.name.trim(),
    repository: typed.repository.trim(),
    hash: typed.hash.trim(),
    seed: typed.seed.trim(),
  };
}

export default function BenchmarkSubmissionPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // A details page's "Populate new submission form" button routes here with prefill.
  const prefill = (useLocation().state as { prefillData?: BenchmarkPrefill } | null)?.prefillData;
  const [name, setName] = useState(prefill?.name ?? '');
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [repository, setRepository] = useState(prefill?.repository ?? '');
  const [hash, setHash] = useState(prefill?.hash ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [data, setData] = useState<BenchmarkFormData | null>(null);

  useEffect(() => {
    benchmarksApi.getFormData().then((d) => {
      setData(d);
      // Seed each variant benchmark field from the prefill, else its first option / empty.
      setFields(Object.fromEntries(d.benchmark_fields.map((f) => [f.name, prefill?.fields?.[f.name] ?? f.options?.[0] ?? ''])));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulerEnabled = data?.scheduler_enabled ?? true;
  const usesCategories = data?.uses_categories ?? true;
  const isRemoteDocker = data?.execution_backend === 'remote_docker';

  const importDataJson = async (file: File) => {
    const parsed = parseDataJson(await file.text());
    setName(parsed.name);
    setRepository(parsed.repository);
    setHash(parsed.hash);
    setImportNotice({ severity: 'success', text: `Imported ${file.name} successfully.` });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) {
      setImportNotice({ severity: 'error', text: 'Drop a data.json file to import benchmark metadata.' });
      return;
    }
    try {
      await importDataJson(file);
    } catch (error: unknown) {
      setImportNotice({ severity: 'error', text: error instanceof Error ? error.message : 'Could not import the file.' });
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Flat fields: the submit endpoint runs the benchmark task and returns its id.
      const payload: Record<string, unknown> = { repository, hash, ...fields };
      if (usesCategories) {
        // A category variant loads a whole category from one repo — no per-benchmark name.
        payload.category = category;
      } else {
        payload.name = name;
      }
      const { redirect_to } = await benchmarksApi.submit(payload);
      navigate(`/benchmark/submission/${redirect_to}`);
    } catch (error: unknown) {
      const data = apiErrorData(error);
      setMessage(typeof data === 'string' ? data : JSON.stringify(data ?? 'Submission failed'));
    }
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: 'Submit' }]} />
        <PageTitle>Submit a Benchmark</PageTitle>
        <Typography variant="body1" color="text.secondary">
          Use this form to submit a new proposed benchmark. The required layout is described on the{' '}
          <MuiLink component={Link} to="/benchmark/info">benchmark info page</MuiLink>.
        </Typography>
      </PageHeader>

      <PageSection maxWidth="md">
        {message && <Alert severity="error" sx={{ mb: 3 }}>{message}</Alert>}
        {!schedulerEnabled && <Alert severity="warning" sx={{ mb: 3 }}>Submissions are paused because the scheduler is currently disabled.</Alert>}
      {isRemoteDocker && <Alert severity="warning" sx={{ mb: 3 }}>This deployment uses remote_docker for submissions. The task may spend longer in worker assignment while the worker service provisions and boots your container.</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Box
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFilePicker();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDropActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setIsDropActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDropActive(false);
            }}
            onDrop={handleDrop}
            sx={{
              mb: 3,
              p: 2,
              border: '1px dashed',
              borderColor: isDropActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isDropActive ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'border-color 120ms ease, background-color 120ms ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void handleFiles(e.target.files || []);
                e.currentTarget.value = '';
              }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Drop data.json here or click to import benchmark metadata
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Expected fields: name, repository, hash, seed.
            </Typography>
            {importNotice && (
              <Alert severity={importNotice.severity} variant="outlined" sx={{ mt: 1.5 }}>
                {importNotice.text}
              </Alert>
            )}
          </Box>

          {/* A category variant (ARCH) submits a whole category from one repo, so there is
              no per-benchmark name; a name variant (VNN) names the single benchmark. */}
          {data && !usesCategories && (
            <TextField fullWidth label="Benchmark name" value={name} onChange={(e) => setName(e.target.value)} required sx={{ mb: 3 }} />
          )}

          {data && usesCategories && (
            <TextField fullWidth select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required sx={{ mb: 3 }}
              helperText="One submission loads all of the category's benchmarks. Create categories on the Toolkit page.">
              {(data?.categories ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              {(data?.categories ?? []).length === 0 && <MenuItem disabled value="">No categories yet</MenuItem>}
            </TextField>
          )}

          <TextField fullWidth label="Git repository URL" value={repository} onChange={(e) => setRepository(e.target.value)} required sx={{ mb: 3 }}
            helperText={usesCategories
              ? "Any git URL. Its instances.csv lists every benchmark and instance in the category. The commit hash below selects the exact revision."
              : "Any git URL. The benchmark's generator script is run from this repo to produce instances.csv and the instance files. The commit hash below selects the exact revision."} />

          <TextField fullWidth label="Commit hash (optional)" value={hash} onChange={(e) => setHash(e.target.value)} sx={{ mb: 3 }}
            helperText="Leave empty to use the latest commit on the repository's default branch." />

          {(data?.benchmark_fields ?? []).map((f) => (
            f.type === 'select' ? (
              <TextField key={f.name} fullWidth select label={labelFor(f.name)} value={fields[f.name] ?? ''}
                onChange={(e) => setFields((s) => ({ ...s, [f.name]: e.target.value }))} required sx={{ mb: 3 }}>
                {(f.options ?? []).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            ) : (
              <TextField key={f.name} fullWidth label={labelFor(f.name)} value={fields[f.name] ?? ''}
                onChange={(e) => setFields((s) => ({ ...s, [f.name]: e.target.value }))} sx={{ mb: 3 }} />
            )
          ))}

          <Button fullWidth type="submit" variant="contained" size="large">Submit benchmark</Button>
        </Box>
      </PageSection>
    </>
  );
}
