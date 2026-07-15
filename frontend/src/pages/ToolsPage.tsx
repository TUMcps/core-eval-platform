import { useEffect, useState } from 'react';
import {
  Box, Card, CardHeader, CardContent, Typography, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TextField, MenuItem, Stack, Alert, Checkbox, FormControlLabel,
  Divider, Snackbar, Grid,
} from '@mui/material';
import { toolsApi, categoriesApi, competitionApi } from '../api';
import type { Tool, Category, CompetitionInfo, FieldSpec } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import StatusChip from '../components/StatusChip';

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comp, setComp] = useState<CompetitionInfo | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [repository, setRepository] = useState('');
  const [baseImage, setBaseImage] = useState('');
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => { setTools(await toolsApi.list()); setCategories(await categoriesApi.list()); };
  useEffect(() => { load(); competitionApi.info().then(setComp).catch(() => {}); }, []);

  const fields: FieldSpec[] = comp?.presentation?.submission_fields ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await toolsApi.create({ name, category, repository, base_image: baseImage, extra });
      setName(''); setRepository(''); setBaseImage(''); setExtra({});
      await load(); setToast('Tool submitted');
    } catch (err: any) { setError(typeof err?.response?.data === 'string' ? err.response.data : JSON.stringify(err?.response?.data ?? 'Failed')); }
  };

  const run = async (id: string) => {
    try { const t = await toolsApi.run(id); setToast(`Run: ${t.outcome} · ${t.steps.length} steps`); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Run failed')); }
  };

  const addCategory = async () => {
    if (!newCategory) return;
    await categoriesApi.create(newCategory); setNewCategory(''); setCategories(await categoriesApi.list());
  };

  const renderField = (f: FieldSpec) => {
    const value = extra[f.name] ?? (f.type === 'bool' ? false : '');
    const set = (v: unknown) => setExtra((x) => ({ ...x, [f.name]: v }));
    if (f.type === 'bool') return <FormControlLabel key={f.name} control={<Checkbox checked={!!value} onChange={(e) => set(e.target.checked)} />} label={f.name} />;
    if (f.type === 'select') return (
      <TextField key={f.name} select label={f.name} value={value} onChange={(e) => set(e.target.value)} sx={{ minWidth: 170 }}>
        {(f.options ?? []).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    );
    return <TextField key={f.name} label={f.name} value={value} onChange={(e) => set(e.target.value)} />;
  };

  return (
    <>
      <PageHeader title="Tools" subtitle="Submit a verification tool and run it against the published benchmarks." />
      <PageSection>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader title="Submit a tool" />
              <CardContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="form" onSubmit={submit}>
                  <Stack spacing={2}>
                    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
                    <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required fullWidth>
                      {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      {categories.length === 0 && <MenuItem disabled value="">Add a category first ↓</MenuItem>}
                    </TextField>
                    <TextField label="Repository" value={repository} onChange={(e) => setRepository(e.target.value)} fullWidth />
                    <TextField label="Base image" value={baseImage} onChange={(e) => setBaseImage(e.target.value)} fullWidth />
                    {fields.length > 0 && (
                      <>
                        <Divider>Competition options</Divider>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">{fields.map(renderField)}</Stack>
                      </>
                    )}
                    <Button type="submit" variant="contained">Submit tool</Button>
                  </Stack>
                </Box>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" gutterBottom>Categories</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" label="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  <Button size="small" variant="outlined" onClick={addCategory}>Add</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader title="Submitted tools" />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow><TableCell>Name</TableCell><TableCell>Repository</TableCell><TableCell>Base image</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow>
                    </TableHead>
                    <TableBody>
                      {tools.map((t) => (
                        <TableRow key={t.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.repository || '—'}</TableCell>
                          <TableCell>{t.base_image || '—'}</TableCell>
                          <TableCell><StatusChip status={t.published ? 'done' : 'pending'} /></TableCell>
                          <TableCell align="right"><Button size="small" variant="outlined" onClick={() => run(t.id)}>Run</Button></TableCell>
                        </TableRow>
                      ))}
                      {tools.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>No tools yet.</Typography></TableCell></TableRow>}
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
