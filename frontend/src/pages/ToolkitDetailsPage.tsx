import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Chip, Stack, Alert } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import OwnerReassign from '../components/OwnerReassign';
import DetailRow from '../components/DetailRow';
import SubmissionDetails from '../components/SubmissionDetails';
import DeleteSubmissionDialog from '../components/DeleteSubmissionDialog';
import TaskPipeline from '../components/TaskPipeline';
import TaskTimer from '../components/TaskTimer';
import { useAuth } from '../context/AuthContext';
import { tasksApi, toolsApi, resultsApi } from '../api';
import type { Task, Tool, Result } from '../api';
import { statusChip } from '../constants/status';
import { isPauseKind } from '../constants/steps';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;

const yn = (b: unknown) => (b ? 'yes' : 'no');

export default function ToolkitDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  usePageTitle(task ? `${task.name} (#${task.id})` : 'Toolkit');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const t = await tasksApi.get(id);
      setTask(t);
      // Refetched each poll: the install step records the resolved commit onto the tool.
      if (t.tool) setTool(await toolsApi.get(t.tool).catch(() => null));
      // Each finished benchmark adds its rows, so this grows as the run progresses.
      setResults(await resultsApi.forTask(id).catch(() => []));
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (task && !task.done) { timer.current = setInterval(load, REFRESH_MS); return () => { if (timer.current) clearInterval(timer.current); }; }
    // eslint-disable-next-line
  }, [task?.done, id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!task) return <PageSection><Typography>Task not found.</Typography></PageSection>;

  const overall = statusChip(task.status || (task.done ? 'Done' : 'Running'));
  const active = task.steps.find((s) => s.status === 'active');
  const isPaused = !!active && isPauseKind(active.kind);
  const extra = (tool?.extra ?? {}) as Record<string, any>;
  const benchmarkNames = task.benchmark_progress.map((p) => p.name);
  const scriptDir = tool?.script_dir === '.' ? 'Repository root' : (tool?.script_dir || '—');

  // Imported tasks carry the old system's key names for the same options; take whichever is set.
  const opt = (...names: string[]) => names.map((n) => extra[n]).find((v) => v !== undefined);
  const rootFlags = [
    opt('run_installation_script_as_root', 'run_install_as_root'),
    opt('run_post_installation_script_as_root'),
    opt('run_toolkit_as_root', 'run_tool_as_root'),
  ];
  const holdFlags = [
    opt('manual_installation_step'),
    opt('pause_after_postinstallation'),
    opt('restart_after_postinstallation'),
  ];
  const known = (vs: unknown[]) => vs.some((v) => v !== undefined);

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await tasksApi.abort(task.id)); };
  const doResume = async () => { setTask(await tasksApi.resume(task.id)); };
  const doDelete = async () => {
    setDeleting(true);
    try { await tasksApi.delete(task.id); navigate('/toolkit'); }
    catch (err: any) { setDeleting(false); setDeleteOpen(false); setError(err?.response?.data?.error ?? 'Delete failed'); }
  };
  // Re-open the submission form with this toolkit's inputs prefilled. `extra` holds the
  // submitted option set; the columns after it win, so a resolved hash replaces the
  // (possibly empty) submitted one.
  const repopulate = () => navigate('/toolkit/submit', {
    state: {
      prefillData: {
        ...extra,
        name: task.name,
        repository: tool?.repository ?? '',
        hash: tool?.hash ?? '',
        ami: tool?.base_image ?? '',
        scripts_dir: tool?.script_dir === '.' ? '' : (tool?.script_dir ?? ''),
      },
    },
  });

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit', to: '/toolkit' }, { label: `${task.name} (#${task.id})` }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <PageTitle variant="h3" mb={1}>{task.name}</PageTitle>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={overall.label} color={overall.color} variant={overall.variant} />
              {!task.done && <LiveIndicator label="Live" />}
              <TaskTimer task={task} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isPaused && <Button variant="contained" onClick={doResume}>Continue</Button>}
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={repopulate}>Populate new submission form</Button>
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>Delete submission</Button>
            )}
          </Stack>
        </Box>

        <SubmissionDetails>
          <DetailRow label="Repository"><code>{tool?.repository || task.repository || '—'}</code></DetailRow>
          <DetailRow label="Hash"><code>{tool?.hash || '—'}</code></DetailRow>
          <DetailRow label="Script dir"><code>{scriptDir}</code></DetailRow>
          <DetailRow label="Base image">
            <code>{tool?.base_image || '—'}</code>
            {extra.aws_instance_type ? <> on <code>{extra.aws_instance_type}</code></> : null}
            {extra.eni ? <>, eni <code>{extra.eni}</code></> : null}
          </DetailRow>
          <DetailRow label="VNNLIB version"><code>{extra.vnnlib_version || '—'}</code></DetailRow>
          <DetailRow label="Evaluation mode"><code>{extra.run_networks || '—'}</code></DetailRow>
          <DetailRow label="Benchmarks">{benchmarkNames.join(', ') || '—'}</DetailRow>
          {known(rootFlags) && (
            <DetailRow label="Run as root">
              install: <code>{yn(rootFlags[0])}</code>, post-install: <code>{yn(rootFlags[1])}</code>,{' '}
              toolkit: <code>{yn(rootFlags[2])}</code>
            </DetailRow>
          )}
          {known(holdFlags) && (
            <DetailRow label="Pause / restart">
              after install: <code>{yn(holdFlags[0])}</code>, after post-install: <code>{yn(holdFlags[1])}</code>,{' '}
              restart after post-install: <code>{yn(holdFlags[2])}</code>
            </DetailRow>
          )}
          <DetailRow label="Owner">
            {user?.is_admin ? (
              <OwnerReassign taskId={task.id} currentName={task.user_name} currentEmail={task.user_email} onChanged={load} />
            ) : (
              <OwnerLabel name={task.user_name} email={task.user_email} />
            )}
          </DetailRow>
          {extra.post_install_tool ? (
            <DetailRow label="Post-install script">
              <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace', fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>
                {extra.post_install_tool}
              </Box>
            </DetailRow>
          ) : null}
        </SubmissionDetails>
      </PageHeader>

      <DeleteSubmissionDialog open={deleteOpen} name={task.name} deleting={deleting}
        onCancel={() => setDeleteOpen(false)} onConfirm={doDelete} />

      <PageSection>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Typography variant="h5" fontWeight="bold" gutterBottom>Pipeline</Typography>
        <TaskPipeline steps={task.steps} benchmarkProgress={task.benchmark_progress}
          results={results} taskId={task.id} onTaskChange={setTask} />
      </PageSection>
    </>
  );
}
