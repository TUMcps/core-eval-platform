import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { benchmarksApi } from '../api';
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
import PageSection from '../components/PageSection';

// Turn a field name (e.g. vnnlib_version) into a readable label.
const labelFor = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function BenchmarkSubmissionPage() {
  const navigate = useNavigate();
  // A details page's "Populate new submission form" button routes here with prefill.
  const prefill = (useLocation().state as { prefillData?: any } | null)?.prefillData;
  const [name, setName] = useState(prefill?.name ?? '');
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [repository, setRepository] = useState(prefill?.repository ?? '');
  const [hash, setHash] = useState(prefill?.hash ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Flat fields: the submit endpoint runs a generate+export task and returns its id.
      const payload: any = { name, repository, hash, ...fields };
      if (usesCategories) payload.category = category;  // else the backend files it under 'default'
      const { redirect_to } = await benchmarksApi.submit(payload);
      navigate(`/benchmark/submission/${redirect_to}`);
    } catch (error: any) {
      setMessage(typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data ?? 'Submission failed'));
    }
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: 'Submit' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>Submit a Benchmark</Typography>
        <Typography variant="body1" color="text.secondary">
          Use this form to submit a new proposed benchmark. The required layout is described on the{' '}
          <MuiLink component={Link} to="/benchmark/info">benchmark info page</MuiLink>.
        </Typography>
      </PageHeader>

      <PageSection maxWidth="md">
        {message && <Alert severity="error" sx={{ mb: 3 }}>{message}</Alert>}
        {!schedulerEnabled && <Alert severity="warning" sx={{ mb: 3 }}>Submissions are paused because the scheduler is currently disabled.</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="Benchmark name" value={name} onChange={(e) => setName(e.target.value)} required sx={{ mb: 3 }} />

          {usesCategories && (
            <TextField fullWidth select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required sx={{ mb: 3 }}
              helperText="Benchmarks belong to a category. Create categories on the Toolkit page.">
              {(data?.categories ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              {(data?.categories ?? []).length === 0 && <MenuItem disabled value="">No categories yet</MenuItem>}
            </TextField>
          )}

          <TextField fullWidth label="Git repository URL" value={repository} onChange={(e) => setRepository(e.target.value)} required sx={{ mb: 3 }}
            helperText="Any git URL. The benchmark's generator script is run from this repo to produce instances.csv and the instance files. The commit hash below selects the exact revision." />

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
