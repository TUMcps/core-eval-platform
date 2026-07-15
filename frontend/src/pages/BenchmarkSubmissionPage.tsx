import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

export default function BenchmarkSubmissionPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [repository, setRepository] = useState('');
  const [vnnlibVersion, setVnnlibVersion] = useState('1.0');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<BenchmarkFormData | null>(null);

  useEffect(() => { benchmarksApi.getFormData().then(setData).catch(() => {}); }, []);
  const schedulerEnabled = data?.scheduler_enabled ?? true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const b = await benchmarksApi.create({ name, category, extra: { repository, vnnlib_version: vnnlibVersion } } as any);
      navigate(`/benchmark/submission/${b.id}`);
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

      <PageSection>
        {message && <Alert severity="error" sx={{ mb: 3 }}>{message}</Alert>}
        {!schedulerEnabled && <Alert severity="warning" sx={{ mb: 3 }}>Submissions are paused because the scheduler is currently disabled.</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 720 }}>
          <TextField fullWidth label="Benchmark name" value={name} onChange={(e) => setName(e.target.value)} required sx={{ mb: 3 }} />
          <TextField fullWidth select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required sx={{ mb: 3 }}
            helperText="Benchmarks belong to a category. Create categories on the Toolkit page.">
            {(data?.categories ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            {(data?.categories ?? []).length === 0 && <MenuItem disabled value="">No categories yet</MenuItem>}
          </TextField>
          <TextField fullWidth label="Repository URL (optional)" value={repository} onChange={(e) => setRepository(e.target.value)} sx={{ mb: 3 }} />
          <TextField fullWidth select label="Generated VNNLIB version" value={vnnlibVersion} onChange={(e) => setVnnlibVersion(e.target.value)} required sx={{ mb: 3 }}
            helperText="Choose 1.0 if the generator emits VNNLIB1 and should be converted to 2.0. Choose 2.0 if it already emits VNNLIB2.">
            <MenuItem value="1.0">1.0</MenuItem><MenuItem value="2.0">2.0</MenuItem>
          </TextField>
          <Button fullWidth type="submit" variant="contained" size="large">Submit benchmark</Button>
        </Box>
      </PageSection>
    </>
  );
}
