import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Card, CardHeader, CardContent, Stack, FormControlLabel, Switch, TextField, MenuItem, Button,
  Snackbar, Grid, Typography, Box,
} from '@mui/material';
import { settingsApi } from '../api';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';

type Settings = Record<string, unknown>;

type Field =
  | { key: string; kind: 'bool'; label: string; help: string }
  | { key: string; kind: 'int'; label: string; help: string; min?: number }
  | { key: string; kind: 'select'; label: string; help: string; options: string[] };

const GROUPS: { title: string; subheader: string; fields: Field[] }[] = [
  {
    title: 'Execution',
    subheader: 'Where and how many submissions run',
    fields: [
      { key: 'scheduler_enabled', kind: 'bool', label: 'Scheduler running', help: 'Master switch: when off, no submission advances.' },
      { key: 'execution_backend', kind: 'select', label: 'Execution backend', help: 'Where workers are started.', options: ['local_docker', 'remote_docker', 'aws'] },
      { key: 'max_parallel_nodes', kind: 'int', label: 'Parallel workers', help: 'How many submissions run at once; each runs its benchmarks one after another.', min: 1 },
    ],
  },
  {
    title: 'Accounts',
    subheader: 'Who can sign up and log in',
    fields: [
      { key: 'auto_enable_users', kind: 'bool', label: 'Enable new accounts automatically', help: 'Otherwise a new account waits until an admin enables it under Users.' },
      { key: 'allow_non_admin_login', kind: 'bool', label: 'Non-admins can log in', help: 'When off, only admins can log in.' },
    ],
  },
  {
    title: 'Submissions',
    subheader: 'What non-admins may submit',
    fields: [
      { key: 'users_can_submit_tools', kind: 'bool', label: 'Users can submit tools', help: 'Admins always can.' },
      { key: 'users_can_submit_benchmarks', kind: 'bool', label: 'Users can submit benchmarks', help: 'Admins always can.' },
    ],
  },
  {
    title: 'Timeouts',
    subheader: 'Wall-clock backstops for a whole submission',
    fields: [
      { key: 'enforce_timeouts', kind: 'bool', label: 'Enforce timeouts', help: 'When off, the limits are shown but not applied.' },
      { key: 'submission_timeout', kind: 'int', label: 'Per submission (hours)', help: 'Base allowance for every submission.', min: 0 },
      { key: 'benchmark_timeout', kind: 'int', label: 'Per benchmark (hours)', help: 'Added for each benchmark the submission runs.', min: 0 },
    ],
  },
];

function FieldControl({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }): ReactNode {
  if (field.kind === 'bool') {
    return (
      <Box>
        <FormControlLabel
          control={<Switch checked={!!value} onChange={(e) => onChange(e.target.checked)} />}
          label={field.label}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>{field.help}</Typography>
      </Box>
    );
  }
  if (field.kind === 'select') {
    return (
      <TextField select label={field.label} helperText={field.help} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    );
  }
  return (
    <TextField
      type="number" label={field.label} helperText={field.help} value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      slotProps={{ htmlInput: { min: field.min } }}
    />
  );
}

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState<Settings>({});
  const [s, setS] = useState<Settings>({});
  const [toast, setToast] = useState('');
  useEffect(() => {
    settingsApi.get().then((x) => { setSaved(x); setS(x); }).catch(() => {});
  }, []);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const dirty = Object.keys(s).some((k) => s[k] !== saved[k]);
  const save = async () => {
    const x = await settingsApi.patch(s);
    setSaved(x);
    setS(x);
    setToast('Saved');
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Settings' }]} />
        <PageTitle>System Settings</PageTitle>
        <Typography variant="body1" color="text.secondary">Runtime configuration for this deployment. Changes apply without a redeploy.</Typography>
      </PageHeader>
      <PageSection>
        <Grid container spacing={3}>
          {GROUPS.map((g) => (
            <Grid key={g.title} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title={g.title} subheader={g.subheader} />
                <CardContent>
                  <Stack spacing={2.5}>
                    {g.fields.map((f) => (
                      <FieldControl key={f.key} field={f} value={s[f.key]} onChange={(v) => set(f.key, v)} />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" size="large" onClick={save} disabled={!dirty}>Save changes</Button>
          <Button size="large" onClick={() => setS(saved)} disabled={!dirty}>Discard</Button>
        </Stack>
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
