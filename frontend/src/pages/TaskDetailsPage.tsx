import { useEffect, useState } from 'react';
import {
  Card, CardHeader, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Stack, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import StatusChip from '../components/StatusChip';

export default function TaskDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  useEffect(() => { if (id) tasksApi.get(id).then(setTask).catch(() => {}); }, [id]);

  return (
    <>
      <PageHeader
        title={task ? `Task ${task.id.slice(0, 8)}` : 'Task'}
        subtitle={task ? <Stack direction="row" spacing={1.5} alignItems="center"><StatusChip status={task.outcome} /><span>{task.tool ? 'tool run' : 'benchmark'} · {new Date(task.created_at).toLocaleString()}</span></Stack> : undefined}
        action={<Button component={RouterLink} to="/tasks" variant="outlined" startIcon={<ArrowBackIcon />}>Back</Button>}
      />
      <PageSection>
        <Card>
          <CardHeader title="Steps" />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>#</TableCell><TableCell>Kind</TableCell><TableCell>Status</TableCell><TableCell>Started</TableCell><TableCell>Finished</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {task?.steps.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.order}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{s.kind}</TableCell>
                      <TableCell><StatusChip status={s.status} /></TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{s.started_at ? new Date(s.started_at).toLocaleTimeString() : '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{s.finished_at ? new Date(s.finished_at).toLocaleTimeString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!task && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>Loading…</Typography></TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </PageSection>
    </>
  );
}
