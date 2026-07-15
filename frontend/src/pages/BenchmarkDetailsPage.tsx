import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardHeader, CardContent, TextField, Stack, Chip, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, CircularProgress, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import { benchmarksApi } from '../api';
import type { Benchmark } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';

export default function BenchmarkDetailsPage() {
  const { id } = useParams();
  const [b, setB] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(b?.name ?? 'Benchmark');
  const [names, setNames] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => { if (id) { try { setB(await benchmarksApi.get(id)); } finally { setLoading(false); } } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!b) return <PageSection><Typography>Benchmark not found.</Typography></PageSection>;

  const addInstances = async () => {
    const list = names.split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    await benchmarksApi.addInstances(b.id, list); setNames(''); await load(); setToast('Instances added');
  };
  const publish = async () => {
    try { await benchmarksApi.publish(b.id); await load(); setToast('Published'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Publish failed')); }
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: b.name }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h3" fontWeight="bold" gutterBottom>{b.name}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={b.published ? 'Published' : 'Draft'} color={b.published ? 'success' : 'default'} />
              <Typography variant="body2" color="text.secondary">{b.category} · {b.instances.length} instances</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" disabled={b.published || b.instances.length === 0} onClick={publish}>Publish</Button>
            <Button component={RouterLink} to="/benchmark" variant="outlined" startIcon={<ArrowBackIcon />}>Back</Button>
          </Stack>
        </Box>
      </PageHeader>

      <PageSection>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Stack spacing={3}>
          <Card>
            <CardHeader title="Add instances" />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter instance names (comma-separated). Each instance is one case the tool runs, passed as run_instance(version, benchmark, instance).
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField fullWidth size="small" placeholder="acc_1, acc_2, airplane_1" value={names} onChange={(e) => setNames(e.target.value)} />
                <Button variant="outlined" onClick={addInstances}>Add</Button>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Instances" />
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>#</TableCell><TableCell>Name</TableCell></TableRow></TableHead>
                  <TableBody>
                    {b.instances.map((i, n) => <TableRow key={i.id} hover><TableCell>{n + 1}</TableCell><TableCell>{i.name}</TableCell></TableRow>)}
                    {b.instances.length === 0 && <TableRow><TableCell colSpan={2}><Typography color="text.secondary" sx={{ py: 2 }}>No instances yet.</Typography></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Stack>
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
