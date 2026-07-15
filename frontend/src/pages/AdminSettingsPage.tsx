import { useEffect, useState } from 'react';
import {
  Card, CardHeader, CardContent, Stack, FormControlLabel, Switch, TextField, MenuItem, Button,
  Snackbar, Divider, Grid,
} from '@mui/material';
import { settingsApi } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';

const BOOLS = [
  'scheduler_enabled', 'terminate_at_end', 'terminate_on_failure', 'allow_non_admin_login',
  'users_can_submit_benchmarks', 'users_can_submit_tools', 'enforce_timeouts', 'allow_full_evaluation',
];
const INTS = ['submission_timeout', 'benchmark_timeout'];

export default function AdminSettingsPage() {
  const [s, setS] = useState<Record<string, any>>({});
  const [toast, setToast] = useState('');
  useEffect(() => { settingsApi.get().then(setS).catch(() => {}); }, []);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => { setS(await settingsApi.patch(s)); setToast('Saved'); };

  return (
    <>
      <PageHeader title="Admin" subtitle="Runtime settings for this deployment."
        action={<Button variant="contained" onClick={save}>Save changes</Button>} />
      <PageSection>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Execution & timeouts" />
              <CardContent>
                <Stack spacing={2.5}>
                  <TextField select label="Execution backend" value={s.execution_backend ?? 'local_docker'} onChange={(e) => set('execution_backend', e.target.value)}>
                    <MenuItem value="local_docker">local_docker</MenuItem>
                    <MenuItem value="aws">aws</MenuItem>
                  </TextField>
                  <Divider>Timeouts (hours)</Divider>
                  <Stack direction="row" spacing={2}>
                    {INTS.map((k) => <TextField key={k} type="number" label={k} value={s[k] ?? 0} onChange={(e) => set(k, Number(e.target.value))} fullWidth />)}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Flags" />
              <CardContent>
                <Stack>
                  {BOOLS.map((k) => (
                    <FormControlLabel key={k} control={<Switch checked={!!s[k]} onChange={(e) => set(k, e.target.checked)} />} label={k} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
