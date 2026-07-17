import { useState, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Paper, Chip, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LiveIndicator from './LiveIndicator';
import CollapsibleSection from './CollapsibleSection';
import StepResults, { ResultsOverview } from './StepResults';
import StepTimer from './StepTimer';
import { tasksApi } from '../api';
import type { TaskStep, BenchmarkProgress, Result } from '../api';
import { statusChip } from '../constants/status';
import { KIND_LABEL, STEP_STATUS, isPauseKind } from '../constants/steps';
import { logTail } from '../utils/logTail';

const isAtBottom = (el: HTMLDivElement | null) =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight < 50;

/** The step that validates a benchmark's counterexamples; shown inside that benchmark. */
const SCORING_KIND = 'vnn_check_results';

/** Step statuses that will not change again. */
const SETTLED = new Set(['done', 'failed', 'aborted']);

interface Props {
  steps: TaskStep[];
  /** Names each run_benchmark step, keyed by step order. */
  benchmarkProgress?: BenchmarkProgress[];
  /** The task's parsed results; each lands under the benchmark step that produced it. */
  results?: Result[];
  /** The task these steps belong to; needed to download a step's exported archive. */
  taskId?: number;
}

/** A submission's ordered steps: status, live-tailing logs, per-benchmark results, timings. */
export default function TaskPipeline({ steps, benchmarkProgress, results = [], taskId }: Props) {
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [openScoring, setOpenScoring] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // A log box follows its tail until the user scrolls up inside it, so reading
  // earlier output isn't yanked back down by the next refresh.
  const pinned = useRef<Record<string, boolean>>({});

  const jumpToTail = (id: string) => {
    const el = logRefs.current[id];
    if (el) el.scrollTop = el.scrollHeight;
  };

  const download = async (step: TaskStep) => {
    if (taskId === undefined) return;
    setDownloading((d) => ({ ...d, [step.id]: true }));
    try {
      const blob = await tasksApi.resultsArchive(taskId, step.order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task${taskId}_step${step.order}_results.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // The button only shows once the export step is done, so a failure here means
      // the archive went missing server-side; the step's own log says why.
    } finally {
      setDownloading((d) => ({ ...d, [step.id]: false }));
    }
  };

  const benchmarkAt = new Map((benchmarkProgress ?? []).map((p) => [p.step_id, p.name]));
  /** The benchmark a run step ran, or undefined for every other kind. */
  const benchmarkOf = (s: TaskStep) => (s.kind === 'run_benchmark' ? benchmarkAt.get(s.order) : undefined);

  // Validating a benchmark is part of that benchmark's story, so its step is folded
  // into the run's rather than listed on its own. build_steps emits it directly after
  // the run it validates.
  const scoringFor = (s: TaskStep) =>
    steps.find((c) => c.kind === SCORING_KIND && c.order > s.order
      && !steps.some((between) => between.kind === 'run_benchmark'
        && between.order > s.order && between.order < c.order));
  const shown = steps.filter((s) => s.kind !== SCORING_KIND);
  const stepName = (s: TaskStep): ReactNode => {
    const name = benchmarkOf(s);
    if (name) return <>Run benchmark: <strong>{name}</strong></>;
    return KIND_LABEL[s.kind] ?? s.kind;
  };

  useLayoutEffect(() => {
    steps.forEach((s) => { if (pinned.current[s.id] ?? true) jumpToTail(s.id); });
  }, [steps]);

  return (
    <>
      {shown.map((s, index) => {
        const scoring = s.kind === 'run_benchmark' ? scoringFor(s) : undefined;
        // A benchmark is only finished once its validation is, so the pair reads as one
        // step: while scoring runs, the benchmark is still working.
        const active = s.status === 'active' || scoring?.status === 'active';
        // A run with no scoring step (an old task, or a variant that scores nothing) has
        // nothing left to wait for, so its own rows are the final word.
        const scoringSettled = scoring ? SETTLED.has(scoring.status) : true;
        const paused = s.status === 'active' && isPauseKind(s.kind);
        const chip = statusChip(paused ? 'Paused' : (STEP_STATUS[s.status] ?? 'Pending'));
        const logsOpen = openLogs[s.id] ?? active;  // the running step's logs start expanded
        const name = benchmarkOf(s);
        const stepResults = name ? results.filter((r) => r.benchmark_name === name) : [];
        return (
          <Paper key={s.id} id={`step-${s.order}`} elevation={active ? 3 : 0}
            sx={{ p: 3, mb: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: active ? 'secondary.main' : 'grey.300' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {/* Numbered by what is listed, not by step order: the folded-in scoring
                  steps would otherwise leave gaps. The anchor keeps the real order. */}
              <Typography sx={{ fontWeight: 600, minWidth: 24, color: 'text.secondary' }}>{index + 1}.</Typography>
              <Typography sx={{ fontWeight: 600, flexGrow: 1 }} component="div">{stepName(s)}</Typography>
              {active && !paused && <LiveIndicator label={null} />}
              <Chip size="small" label={chip.label} color={chip.color} variant={chip.variant} />
            </Box>

            <Box sx={{ mt: 0.5, mb: 0.5 }}>
              <StepTimer startedAt={s.started_at} finishedAt={s.finished_at} active={s.status === 'active'}
                timeoutHours={s.timeout_hours} timeoutEnforced={s.timeout_enforced} />
            </Box>

            {s.has_logs ? (
              <CollapsibleSection title="Logs" open={logsOpen}
                onToggle={() => {
                  const next = !logsOpen;
                  setOpenLogs((o) => ({ ...o, [s.id]: next }));
                  // Opening a collapsed log jumps it to the tail (after the expand animation).
                  if (next) { pinned.current[s.id] = true; setTimeout(() => jumpToTail(s.id), 120); }
                }}>
                <Box className="console_log"
                  ref={(el: HTMLDivElement | null) => { logRefs.current[s.id] = el; }}
                  onScroll={(e) => { pinned.current[s.id] = isAtBottom(e.currentTarget); }}>
                  {logTail(s.logs)}
                </Box>
              </CollapsibleSection>
            ) : active ? (
              // A step with nothing to say yet is left silent: only a running one is
              // worth a placeholder, because its logs are still coming.
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Running… logs will appear here as the worker reports back.
              </Typography>
            ) : null}

            {s.can_download_results && taskId !== undefined && (
              <Box sx={{ mt: 1.5 }}>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                  disabled={!!downloading[s.id]} onClick={() => download(s)}>
                  {downloading[s.id] ? 'Preparing download…' : 'Download results'}
                </Button>
              </Box>
            )}

            {s.results && (
              <CollapsibleSection title="Results"
                open={openResults[s.id] ?? false}
                onToggle={() => setOpenResults((o) => ({ ...o, [s.id]: !(o[s.id] ?? false) }))}>
                <StepResults csv={s.results} results={stepResults} />
              </CollapsibleSection>
            )}

            {scoring && (scoring.has_logs || scoring.status === 'active') && (
              <CollapsibleSection title="Scoring logs"
                open={openScoring[s.id] ?? false}
                onToggle={() => setOpenScoring((o) => ({ ...o, [s.id]: !(o[s.id] ?? false) }))}>
                <Box className="console_log">
                  {scoring.has_logs
                    ? logTail(scoring.logs)
                    : 'Validating the counterexamples with the official scorer…'}
                </Box>
              </CollapsibleSection>
            )}

            {/* The verdict on the run: never collapsed, since it is the thing to read.
                Held back until the scorer has finished (or failed), because until then
                the fallback would state a verdict the scorer may still overturn. */}
            {scoringSettled && (scoring?.summary || stepResults.length > 0) && (
              <Box sx={{ mt: 2 }}>
                <ResultsOverview summary={scoring?.summary ?? null} results={stepResults} />
              </Box>
            )}
          </Paper>
        );
      })}
    </>
  );
}
