import { useEffect, useState } from 'react';
import {
  Paper, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Stack, Alert, Snackbar, Box,
} from '@mui/material';
import { benchmarksApi, categoriesApi } from '../api';
import type { Benchmark, Category } from '../api';
import StatusChip from '../components/StatusChip';

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [instances, setInstances] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    setBenchmarks(await benchmarksApi.list());
    setCategories(await categoriesApi.list());
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await benchmarksApi.create({ name, category });
      setName('');
      await load();
      setToast('Benchmark created — add instances, then publish');
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data ?? 'Failed'));
    }
  };

  const addInstances = async (b: Benchmark) => {
    const names = (instances[b.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    await benchmarksApi.addInstances(b.id, names);
    setInstances((x) => ({ ...x, [b.id]: '' }));
    await load();
  };

  const publish = async (b: Benchmark) => {
    try { await benchmarksApi.publish(b.id); await load(); setToast('Published'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Publish failed')); }
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Submit a benchmark</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={submit}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required sx={{ minWidth: 160 }}>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Button type="submit" variant="contained">Create</Button>
          </Stack>
        </form>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Benchmarks</Typography>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Name</TableCell><TableCell>Instances</TableCell><TableCell>Published</TableCell><TableCell>Add instances (comma-separated)</TableCell><TableCell align="right" /></TableRow>
          </TableHead>
          <TableBody>
            {benchmarks.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.instances.map((i) => i.name).join(', ') || '—'}</TableCell>
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
            {benchmarks.length === 0 && <TableRow><TableCell colSpan={5}><Box sx={{ color: 'text.secondary' }}>No benchmarks yet.</Box></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Stack>
  );
}
