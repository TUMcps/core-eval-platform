import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, CircularProgress, Chip, Accordion, AccordionSummary,
  AccordionDetails, Stack, Snackbar, Alert, Collapse, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import { tasksApi, benchmarksApi } from '../api';
import type { Task, TaskStep, Benchmark } from '../api';
import { statusChip } from '../constants/status';
import { formatDateTime } from '../utils/datetime';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;
const STEP_STATUS: Record<string, string> = { pending: 'Pending', active: 'Running', done: 'Done', failed: 'Error', aborted: 'Aborted' };
const PAUSE_KIND = 'vnn_pause';

// Friendlier step names than the raw kinds.
const KIND_LABEL: Record<string, string> = {
  vnn_create: 'Create submission', assign: 'Assign worker', vnn_generate: 'Generate instances',
  vnn_benchmark_export: 'Export to benchmarks repo', vnn_pause: 'Paused (waiting to continue)', shutdown: 'Shutdown',
};

/** One label/value pair in the compact submission-details grid. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" component="div">{children}</Typography>
    </>
  );
}

export default function BenchmarkDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  usePageTitle(task?.name ?? 'Benchmark');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Per-step log <pre> nodes, plus scroll bookkeeping so a live refresh only
  // follows the tail when the user is already at the bottom.
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pinnedToBottom = useRef<Record<string, boolean>>({});
  const positioned = useRef<Set<string>>(new Set());
  const isAtBottom = (el: HTMLDivElement | null) =>
    !el || el.scrollHeight - el.scrollTop - el.clientHeight < 50;

  const load = async () => {
    if (!id) return;
    try {
      const t = await tasksApi.get(id);
      // Capture bottom-pinned state BEFORE the new logs grow the boxes.
      pinnedToBottom.current = Object.fromEntries(
        Object.keys(logRefs.current).map((sid) => [sid, isAtBottom(logRefs.current[sid])]),
      );
      setTask(t);
      // Once files exist, show the benchmark's instances + publish control.
      if (t.benchmark) setBenchmark(await benchmarksApi.get(t.benchmark).catch(() => null));
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (task && !task.done) { timer.current = setInterval(load, REFRESH_MS); return () => { if (timer.current) clearInterval(timer.current); }; }
    // eslint-disable-next-line
  }, [task?.done, id]);

  // After each render, pin a log box to its tail when it first appears (default to
  // bottom) or when the user was already at the bottom before the refresh.
  useLayoutEffect(() => {
    task?.steps.forEach((s) => {
      const el = logRefs.current[s.id];
      if (!el) return;
      if (!positioned.current.has(s.id) || pinnedToBottom.current[s.id]) {
        el.scrollTop = el.scrollHeight;
        positioned.current.add(s.id);
      }
    });
  }, [task]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!task) return <PageSection><Typography>Task not found.</Typography></PageSection>;

  const overall = statusChip(task.status || (task.done ? 'Done' : 'Running'));
  const current = task.steps.find((s) => s.status === 'active');
  const isPaused = current?.kind === PAUSE_KIND;
  const stepName = (s: TaskStep) => KIND_LABEL[s.kind] ?? s.kind;
  const extra = (benchmark?.extra ?? {}) as Record<string, string>;

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await tasksApi.abort(task.id)); };
  const doResume = async () => { setTask(await tasksApi.resume(task.id)); };
  const doDelete = async () => {
    setDeleting(true);
    try { await tasksApi.delete(task.id); navigate('/benchmark'); }
    catch (err: any) { setDeleting(false); setDeleteOpen(false); setError(err?.response?.data?.error ?? 'Delete failed'); }
  };
  const publish = async () => {
    if (!benchmark) return;
    try { setBenchmark(await benchmarksApi.publish(benchmark.id)); setToast('Published'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Publish failed')); }
  };
  // Re-open the submission form with this benchmark's inputs prefilled.
  const repopulate = () => navigate('/benchmark/submit', {
    state: { prefillData: { name: task.name, repository: extra.repository ?? '', category: benchmark?.category ?? '', fields: extra } },
  });

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: task.name }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h3" fontWeight="bold" gutterBottom>{task.name}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={overall.label} color={overall.color} variant={overall.variant} />
              {!task.done && <LiveIndicator label="Live" />}
              <Typography variant="body2" color="text.secondary">Submitted {formatDateTime(task.created_at)}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isPaused && <Button variant="contained" onClick={doResume}>Continue</Button>}
            {benchmark && task.done && task.status === 'Done' && <Button variant="contained" disabled={benchmark.published} onClick={publish}>{benchmark.published ? 'Published' : 'Publish'}</Button>}
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={repopulate}>Populate new submission form</Button>
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>Delete submission</Button>
            )}
          </Stack>
        </Box>

        <Accordion disableGutters elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 500 }}>Submission details</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 0.75, alignItems: 'baseline' }}>
              <DetailRow label="Repository"><code>{extra.repository || '—'}</code></DetailRow>
              <DetailRow label="Hash"><code>{extra.hash || '—'}</code></DetailRow>
              <DetailRow label="VNNLIB version"><code>{extra.vnnlib_version || '—'}</code></DetailRow>
              <DetailRow label="Owner"><OwnerLabel name={task.user_name} email={task.user_email} /></DetailRow>
            </Box>
          </AccordionDetails>
        </Accordion>
      </PageHeader>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogTitle>Delete this submission?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes <strong>{task.name}</strong> and all of its steps, logs, and
            results. The generated benchmark itself is not removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={doDelete} color="error" variant="contained" disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>

      <PageSection>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Typography variant="h5" fontWeight="bold" gutterBottom>Pipeline</Typography>
        {task.steps.map((s) => {
          const chip = statusChip(STEP_STATUS[s.status] ?? 'Pending');
          const active = s.status === 'active';
          const open = openLogs[s.id] ?? active;  // the running step's logs start expanded
          return (
            <Paper key={s.id} id={`step-${s.order}`} elevation={active ? 3 : 1}
              sx={{ p: 3, mb: 2, border: active ? '1px solid' : '1px solid transparent', borderColor: active ? 'secondary.main' : 'transparent' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600, minWidth: 24, color: 'text.secondary' }}>{s.order + 1}.</Typography>
                <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{stepName(s)}</Typography>
                {active && <LiveIndicator label={null} />}
                <Chip size="small" label={chip.label} color={chip.color} variant={chip.variant} />
              </Box>

              {s.has_logs ? (
                <Box sx={{ mt: 1.5 }}>
                  <Box onClick={() => {
                    const next = !open;
                    setOpenLogs((o) => ({ ...o, [s.id]: next }));
                    // Opening a collapsed log jumps it to the tail (after the expand animation).
                    if (next) setTimeout(() => { const el = logRefs.current[s.id]; if (el) el.scrollTop = el.scrollHeight; }, 120);
                  }}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', p: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><ExpandMoreIcon /></IconButton>
                    <Typography variant="body2" fontWeight="medium">Logs</Typography>
                  </Box>
                  <Collapse in={open}>
                    <Box className="console_log" ref={(el: HTMLDivElement | null) => { logRefs.current[s.id] = el; }}>{s.logs}</Box>
                  </Collapse>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {active ? 'Running… logs will appear here as the worker reports back.' : 'No logs for this step.'}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {s.started_at ? `started ${formatDateTime(s.started_at)}` : 'not started'}
                {s.finished_at ? ` · finished ${formatDateTime(s.finished_at)}` : ''}
              </Typography>
            </Paper>
          );
        })}

        {benchmark && task.done && task.status === 'Done' && (
          <Alert severity="success" sx={{ mt: 3 }}>
            Benchmark generated and pushed to the benchmarks repository.
            {benchmark.published ? ' It is published and available to tool submissions.' : ' Publish it to make it available to tool submissions.'}
          </Alert>
        )}
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
