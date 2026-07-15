import { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import StatusChip from '../components/StatusChip';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => { tasksApi.list().then(setTasks).catch(() => {}); }, []);

  return (
    <>
      <PageHeader title="Tasks" subtitle="Every run of the pipeline and where it is in the step machine." />
      <PageSection>
        <Card>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Task</TableCell><TableCell>Outcome</TableCell><TableCell>Steps</TableCell><TableCell>Created</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((t) => (
                    <TableRow key={t.id} hover>
                      <TableCell><RouterLink to={`/tasks/${t.id}`} style={{ fontWeight: 600 }}>{t.id.slice(0, 8)}</RouterLink></TableCell>
                      <TableCell><StatusChip status={t.outcome} /></TableCell>
                      <TableCell>{t.steps.length}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{new Date(t.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {tasks.length === 0 && <TableRow><TableCell colSpan={4}><Typography color="text.secondary" sx={{ py: 2 }}>No tasks yet — run a tool.</Typography></TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </PageSection>
    </>
  );
}
