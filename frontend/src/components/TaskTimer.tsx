import type { Task } from '../api';
import StepTimer from './StepTimer';

/**
 * The whole submission's start and running total, mirroring each step's timer: from the
 * first step to begin through the last to finish, or ticking live until the task is done.
 * Falls back to the submission time before any step has started.
 */
export default function TaskTimer({ task }: { task: Task }) {
  const started = task.steps.map((s) => s.started_at).filter((v): v is string => !!v);
  const finished = task.steps.map((s) => s.finished_at).filter((v): v is string => !!v);
  const overallStart = started.length ? started.reduce((a, b) => (a < b ? a : b)) : task.created_at;
  const overallFinish = task.done && finished.length ? finished.reduce((a, b) => (a > b ? a : b)) : null;
  return <StepTimer startedAt={overallStart} finishedAt={overallFinish} active={!task.done} />;
}
