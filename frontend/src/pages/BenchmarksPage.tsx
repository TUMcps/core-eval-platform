import { useEffect, useState } from 'react';
import {
  Box, Card, CardHeader, CardContent, Typography, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TextField, MenuItem, Stack, Alert, Snackbar, Grid,
} from '@mui/material';
import { benchmarksApi, categoriesApi } from '../api';
import type { Benchmark, Category } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import StatusChip from '../components/StatusChip';

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [instances, setInstances] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => { setBenchmarks(await benchmarksApi.list()); setCategories(await categoriesApi.list()); };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { await benchmarksApi.create({ name, category }); setName(''); await load(); setToast('Benchmark created — add instances, then publish'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Failed')); }
  };
  const addInstances = async (b: Benchmark) => {
    const names = (instances[b.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    await benchmarksApi.addInstances(b.id, names); setInstances((x) => ({ ...x, [b.id]: '' })); await load();
  };
  const publish = async (b: Benchmark) => {
    try { await benchmarksApi.publish(b.id); await load(); setToast('Published'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Publish failed')); }
  };

  return (
    <>
      <PageHeader title="Benchmarks" subtitle="Define benchmarks and their instances, then publish them for tools to run against." />
      <PageSection>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardHeader title="Submit a benchmark" />
              <CardContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="form" onSubmit={submit}>
                  <Stack spacing={2}>
                    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
                    <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required fullWidth>
                      {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      {categories.length === 0 && <MenuItem disabled value="">Create a category on the Tools page first</MenuItem>}
                    </TextField>
                    <Button type="submit" variant="contained">Create</Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardHeader title="Benchmarks" />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow><TableCell>Name</TableCell><TableCell>Instances</TableCell><TableCell>Status</TableCell><TableCell>Add instances</TableCell><TableCell align="right" /></TableRow>
                    </TableHead>
                    <TableBody>
                      {benchmarks.map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{b.instances.map((i) => i.name).join(', ') || '—'}</TableCell>
                          <TableCell><StatusChip status={b.published ? 'done' : 'pending'} /></TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <TextField size="small" placeholder="i1, i2, i3" value={instances[b.id] ?? ''} onChange={(e) => setInstances((x) => ({ ...x, [b.id]: e.target.value }))} />
                              <Button size="small" variant="outlined" onClick={() => addInstances(b)}>Add</Button>
                            </Stack>
                          </TableCell>
                          <TableCell align="right"><Button size="small" variant="contained" disabled={b.published} onClick={() => publish(b)}>Publish</Button></TableCell>
                        </TableRow>
                      ))}
                      {benchmarks.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>No benchmarks yet.</Typography></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
