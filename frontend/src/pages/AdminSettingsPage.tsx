import { useEffect, useState } from 'react';
import {
  Paper, Typography, Stack, FormControlLabel, Switch, TextField, MenuItem, Button, Snackbar, Divider,
} from '@mui/material';
import { settingsApi } from '../api';

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
    <Paper sx={{ p: 3, maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>Runtime settings</Typography>
      <Stack spacing={1.5}>
        <TextField select label="Execution backend" value={s.execution_backend ?? 'local_docker'} onChange={(e) => set('execution_backend', e.target.value)} sx={{ maxWidth: 240 }}>
          <MenuItem value="local_docker">local_docker</MenuItem>
          <MenuItem value="aws">aws</MenuItem>
        </TextField>
        <Divider>Flags</Divider>
        {BOOLS.map((k) => (
          <FormControlLabel key={k} control={<Switch checked={!!s[k]} onChange={(e) => set(k, e.target.checked)} />} label={k} />
        ))}
        <Divider>Timeouts (hours)</Divider>
        <Stack direction="row" spacing={2}>
          {INTS.map((k) => (
            <TextField key={k} type="number" label={k} value={s[k] ?? 0} onChange={(e) => set(k, Number(e.target.value))} />
          ))}
        </Stack>
        <div><Button variant="contained" onClick={save}>Save</Button></div>
      </Stack>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Paper>
  );
}
