import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Link as MuiLink, MenuItem, FormControlLabel,
  Checkbox, Alert, Divider, FormGroup, Accordion, AccordionDetails, AccordionSummary,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toolkitApi } from '../api';
import type { ToolkitFormData } from '../api';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import { useAuth } from '../context/AuthContext';

export default function ToolkitSubmissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    name: '', repository: '', hash: '', ami: '', aws_instance_type: 't2.large', eni: '', use_own_eni: false,
    scripts_dir: '', manual_installation_step: false, run_installation_script_as_root: false,
    run_post_installation_script_as_root: false, run_toolkit_as_root: false, post_install_tool: '',
    vnnlib_version: '1.0', run_networks: 'all', benchmarks: [] as string[],
    pause_after_postinstallation: false, restart_after_postinstallation: false,
    reverse_order: false, split: 0, export_results: false, force_pause: false, force_no_pause: false, local_execution: false,
  });
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));
  const [message, setMessage] = useState('');
  const [data, setData] = useState<ToolkitFormData | null>(null);
  const [useRepoRoot, setUseRepoRoot] = useState(true);

  useEffect(() => {
    toolkitApi.getFormData().then((d) => {
      setData(d);
      set({ ami: form.ami || d.ami_options[0]?.value || '', run_networks: d.run_networks_options[0]?.value || 'all' });
    }).catch(() => setMessage('Failed to load form data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDocker = data?.execution_backend === 'local_docker';
  const canSubmit = data?.can_submit ?? true;
  const schedulerEnabled = data?.scheduler_enabled ?? true;

  const toggleBenchmark = (id: string) => set({ benchmarks: form.benchmarks.includes(id) ? form.benchmarks.filter((b: string) => b !== id) : [...form.benchmarks, id] });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return setMessage('Submission is currently closed');
    if (!schedulerEnabled) return setMessage('Submissions are paused: the scheduler is currently disabled.');
    try {
      const payload: any = {
        name: form.name, repository: form.repository, hash: form.hash, ami: form.ami,
        aws_instance_type: form.aws_instance_type, scripts_dir: useRepoRoot ? '.' : form.scripts_dir.trim(),
        manual_installation_step: form.manual_installation_step,
        run_installation_script_as_root: form.run_installation_script_as_root,
        run_post_installation_script_as_root: form.run_post_installation_script_as_root,
        run_toolkit_as_root: form.run_toolkit_as_root, vnnlib_version: form.vnnlib_version,
        benchmarks: form.benchmarks, run_networks: form.run_networks, use_own_eni: form.use_own_eni,
      };
      if (!form.use_own_eni && form.eni) payload.eni = form.eni;
      if (form.post_install_tool) payload.post_install_tool = form.post_install_tool;
      if (form.pause_after_postinstallation) payload.pause_after_postinstallation = true;
      if (form.restart_after_postinstallation) payload.restart_after_postinstallation = true;
      if (user?.is_admin) {
        if (form.reverse_order) payload.reverse_order = true;
        if (form.split > 0) payload.split = form.split;
        if (form.export_results) payload.export_results = true;
        if (form.force_pause) payload.force_pause = true;
        if (form.force_no_pause) payload.force_no_pause = true;
        if (form.local_execution) payload.local_execution = true;
      }
      const result = await toolkitApi.submit(payload);
      navigate(`/toolkit/submission/${result.redirect_to}`);
    } catch (error: any) {
      const errors = error.response?.data?.errors;
      const details = errors ? Object.entries(errors).map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(', ') : String(e)}`).join(' ') : '';
      setMessage(details || error.response?.data?.error || 'Submission failed');
    }
  };

  const help = (t: string) => <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 1.5 }}>{t}</Typography>;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit', to: '/toolkit' }, { label: 'Submit' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>Submit a Toolkit</Typography>
        <Typography variant="body1" color="text.secondary">
          Use this form to submit a new toolkit for benchmarking. See the{' '}
          <MuiLink component={RouterLink} to="/toolkit/info">toolkit info page</MuiLink> for the full submission pipeline.
        </Typography>
      </PageHeader>

      <PageSection>
        {message && <Alert severity="error" sx={{ mb: 3 }}>{message}</Alert>}
        {!canSubmit && <Alert severity="warning" sx={{ mb: 3 }}>Submission is currently closed</Alert>}
        {canSubmit && !schedulerEnabled && <Alert severity="warning" sx={{ mb: 3 }}>Submissions are paused because the scheduler is currently disabled.</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 820 }}>
          <TextField fullWidth label="Toolkit name" value={form.name} onChange={(e) => set({ name: e.target.value })} required margin="normal" />
          <TextField fullWidth label="Git clone URL" required margin="normal" value={form.repository} onChange={(e) => set({ repository: e.target.value })}
            helperText="Any https Git URL, e.g. https://github.com/ABC/DEF. The commit hash below selects the exact revision to clone." />
          <TextField fullWidth label="Commit hash (optional)" margin="normal" value={form.hash} onChange={(e) => set({ hash: e.target.value })}
            helperText="Leave empty to use the latest commit on the repository's default branch." />
          <TextField fullWidth label="Post installation script (e.g. for licenses)" margin="normal" multiline minRows={4}
            value={form.post_install_tool} onChange={(e) => set({ post_install_tool: e.target.value })}
            helperText="Runs after install_tool.sh — the right place for license activation or final machine-specific setup." />

          <Accordion disableGutters elevation={0} sx={{ mt: 3, mb: 2, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 500 }}>Advanced configurations</Typography></AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These options control how the toolkit setup and execution steps are handled on the worker. Most submissions can keep the defaults.
              </Typography>
              <FormGroup>
                <FormControlLabel control={<Checkbox checked={useRepoRoot} onChange={(e) => setUseRepoRoot(e.target.checked)} />} label="The toolkit scripts are in the repository root." />
                <TextField fullWidth label="Scripts subdirectory, relative to repository root" margin="normal" sx={{ mb: 2 }}
                  value={form.scripts_dir} onChange={(e) => set({ scripts_dir: e.target.value })} required={!useRepoRoot} disabled={useRepoRoot}
                  helperText={useRepoRoot ? 'Repository root will be used. Uncheck the box above to enter a subdirectory.' : 'Must contain install_tool.sh, prepare_instance.sh, and run_instance.sh.'} />

                <FormControlLabel control={<Checkbox checked={form.run_installation_script_as_root} onChange={(e) => set({ run_installation_script_as_root: e.target.checked })} />} label="Run installation script as root." />
                {help('Enable only if install_tool.sh needs elevated privileges, e.g. to install system packages.')}
                <FormControlLabel control={<Checkbox checked={form.manual_installation_step} onChange={(e) => set({ manual_installation_step: e.target.checked })} />} label="Pause after installation so you can inspect the instance before post-installation runs." />
                {help('Use this to stop after install_tool.sh, inspect the machine, or adjust the post-install script before continuing.')}
                <FormControlLabel control={<Checkbox checked={form.run_post_installation_script_as_root} onChange={(e) => set({ run_post_installation_script_as_root: e.target.checked })} />} label="Run post-installation script as root." />
                {help('Only when the post-install step needs root for license configuration, service changes, etc.')}
                <FormControlLabel control={<Checkbox checked={form.pause_after_postinstallation} onChange={(e) => set({ pause_after_postinstallation: e.target.checked })} />} label="Pause after the post-installation script is run (e.g. to SSH in and debug)." />
                {help('The task waits on the post-installation step until you continue it from the task details page.')}
                <FormControlLabel control={<Checkbox checked={form.restart_after_postinstallation} onChange={(e) => set({ restart_after_postinstallation: e.target.checked })} />} label="Restart the instance after the post-installation script is run (e.g. to reload GPU drivers)." />
                <FormControlLabel control={<Checkbox checked={form.run_toolkit_as_root} onChange={(e) => set({ run_toolkit_as_root: e.target.checked })} />} label="Run toolkit benchmark execution as root." />
                {help('Unusual — enable only when benchmark execution cannot run correctly as the default user.')}
              </FormGroup>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>{isDocker ? 'Docker Settings' : 'AWS Settings'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {isDocker ? 'Submission will be run within a Docker container on the server.' : 'Submission will be run on an AWS instance.'}
          </Typography>
          {isDocker ? (
            <TextField fullWidth label="Base Docker image" required margin="normal" placeholder="e.g. ubuntu:22.04"
              value={form.ami} onChange={(e) => set({ ami: e.target.value })}
              helperText="Base image the submission runs in (apt-based). GPU images require the NVIDIA Container Toolkit on the host." />
          ) : (
            <>
              <TextField fullWidth select label="AWS instance type" required margin="normal" value={form.aws_instance_type} onChange={(e) => set({ aws_instance_type: e.target.value })}>
                {(data?.instance_types ?? []).map((t) => <MenuItem key={t.value} value={t.value}>{t.label} — {t.hardware} — {t.guidance}</MenuItem>)}
              </TextField>
              <TextField fullWidth select label="AMI image" required margin="normal" value={form.ami} onChange={(e) => set({ ami: e.target.value })}>
                {(data?.ami_options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.value} — {o.label}</MenuItem>)}
              </TextField>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mt: 2 }}>
                <FormControlLabel sx={{ mt: 1, mr: 0, whiteSpace: 'nowrap' }} control={<Checkbox checked={form.use_own_eni} onChange={(e) => set({ use_own_eni: e.target.checked })} />} label="Use own ENI" />
                <TextField fullWidth label="AWS ENI" disabled={form.use_own_eni}
                  value={form.use_own_eni ? (data?.default_eni || '(random MAC — no ENI on this account)') : form.eni}
                  onChange={(e) => set({ eni: e.target.value })}
                  helperText={form.use_own_eni ? 'Uses the ENI assigned to your account.' : 'Leave blank for a random MAC, or enter a valid ENI for its specific MAC.'} />
              </Box>
            </>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>Benchmarks</Typography>
          <TextField fullWidth select label="Preferred VNNLIB version" required margin="normal" value={form.vnnlib_version} onChange={(e) => set({ vnnlib_version: e.target.value })} helperText="Select the benchmark VNNLIB version to run.">
            <MenuItem value="1.0">1.0</MenuItem><MenuItem value="2.0">2.0</MenuItem>
          </TextField>
          <TextField fullWidth select label="Evaluation mode" required margin="normal" value={form.run_networks} onChange={(e) => set({ run_networks: e.target.value })}>
            {(data?.run_networks_options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>

          <Box sx={{ mt: 3, mb: 2 }}>
            {Object.entries(data?.benchmark_categories ?? {}).map(([key, cat]) => (
              <Box key={key} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 'bold' }}>{cat.label}</Typography>
                <FormGroup>
                  {[...cat.benchmarks].sort((a, b) => a.name.localeCompare(b.name)).map((b) => (
                    <FormControlLabel key={b.id} control={<Checkbox checked={form.benchmarks.includes(b.id)} onChange={() => toggleBenchmark(b.id)} />} label={b.name} />
                  ))}
                </FormGroup>
              </Box>
            ))}
            {Object.keys(data?.benchmark_categories ?? {}).length === 0 && (
              <Typography variant="body2" color="text.secondary">No published benchmarks yet. Publish benchmarks on the Benchmark page first.</Typography>
            )}
          </Box>

          {user?.is_admin && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" gutterBottom>Admin Options</Typography>
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={form.reverse_order} onChange={(e) => set({ reverse_order: e.target.checked })} />} label="Reverse the order of benchmarks" />
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={form.local_execution} onChange={(e) => set({ local_execution: e.target.checked })} />} label="Run locally in the backend container instead of launching AWS instances" />
              {help('For development only: runs the submitted toolkit on the local backend container and shows logs on the details page.')}
              <TextField fullWidth type="number" label="Split submission into several, each with N benchmarks" margin="normal" value={form.split} onChange={(e) => set({ split: parseInt(e.target.value) || 0 })} />
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={form.export_results} onChange={(e) => set({ export_results: e.target.checked })} />} label="Upload results to GitHub" />
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={form.force_pause} onChange={(e) => set({ force_pause: e.target.checked })} />} label="Force pause after installation" />
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={form.force_no_pause} onChange={(e) => set({ force_no_pause: e.target.checked })} />} label="Force no pause after installation" />
            </>
          )}

          <Button type="submit" variant="contained" color="primary" size="large" fullWidth sx={{ mt: 3 }} disabled={!canSubmit || !schedulerEnabled}>Submit toolkit</Button>
        </Box>
      </PageSection>
    </>
  );
}
