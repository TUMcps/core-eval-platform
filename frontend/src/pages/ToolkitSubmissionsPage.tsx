import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import { formatDateTime } from '../utils/datetime';
import { taskPage } from '../api';
import type { Task } from '../api';
import { useAuth } from '../context/AuthContext';
import { statusChip } from '../constants/status';
import { benchmarkStateColor, BENCHMARK_STATE_LEGEND } from '../constants/benchmarks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function ToolkitSubmissionsPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Paint the first page immediately, then backfill the rest in the background, so
  // the table appears at once while search and paging stay instant (client-side)
  // once loaded. The server sorts globally (running first, newest within a group),
  // so appending its chunks keeps the right order. DRF pages are 1-indexed.
  const loadTasks = useCallback(async () => {
    try {
      const first = await taskPage({ type: 'tool', page: 1, pageSize: 25 });
      setTasks(first.results);
      setLoading(false);
      const CHUNK = 100;
      let acc: Task[] = [];
      for (let p = 1; (p - 1) * CHUNK < first.count; p++) {
        const chunk = await taskPage({ type: 'tool', page: p, pageSize: CHUNK });
        acc = acc.concat(chunk.results);
        setTasks(acc);
        if (chunk.results.length < CHUNK) break;
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const anyRunning = tasks.some((t) => !t.done);
  useEffect(() => {
    if (!anyRunning) return;
    const handle = setInterval(loadTasks, 30000);
    return () => clearInterval(handle);
  }, [anyRunning, loadTasks]);

  const filtered = searchTerm ? tasks.filter((t) => t.name?.toLowerCase().includes(searchTerm.toLowerCase())) : tasks;
  useEffect(() => { setPage(0); }, [searchTerm]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit' }]} />
        <PageTitle>Toolkit Submissions</PageTitle>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Use this page to submit a toolkit and review current toolkit submissions.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <Button component={Link} to="/toolkit/submit" variant="contained" size="large">Submit a new toolkit</Button>
          <Button component={Link} to="/toolkit/info" variant="outlined" size="large" sx={{ fontSize: '1rem', px: 4 }}>Read how the system works</Button>
        </Stack>
      </PageHeader>

      <PageSection>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Your Submitted Toolkits</Typography>

        {user?.is_admin && (
          <TextField placeholder="Search for names..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} size="small"
            sx={{ mb: 3, maxWidth: '400px', '& .MuiOutlinedInput-root': { borderRadius: '20px' } }} />
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Benchmark progress:</Typography>
          {BENCHMARK_STATE_LEGEND.map((item) => (
            <Chip key={item.state} label={item.label} color={benchmarkStateColor(item.state)} size="small" />
          ))}
          {anyRunning && <LiveIndicator label="Live" />}
        </Box>

        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                {user?.is_admin && <TableCell sx={{ fontWeight: 600 }}>User</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Benchmarks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((task) => {
                const chip = statusChip(task.status || 'Running');
                const date = formatDateTime(task.created_at);
                return (
                  <TableRow key={task.id} hover>
                    <TableCell>{date}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{task.name}</TableCell>
                    {user?.is_admin && <TableCell sx={{ color: 'text.secondary' }}><OwnerLabel stacked name={task.user_name} email={task.user_email} /></TableCell>}
                    <TableCell>
                      {task.benchmark_progress?.length ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                          {task.benchmark_progress.map((b, i) => (
                            <Fragment key={`${b.name}-${i}`}>
                              <Chip label={b.name} title={b.state} color={benchmarkStateColor(b.state)} size="small" clickable
                                {...({ component: Link, to: `/toolkit/submission/${task.id}#step-${b.step_id}` } as any)} />
                            </Fragment>
                          ))}
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell align="center"><Chip label={chip.label} color={chip.color} variant={chip.variant} size="small" /></TableCell>
                    <TableCell align="center">
                      <Button component={Link} to={`/toolkit/submission/${task.id}`} variant="outlined" size="small" sx={{ fontSize: '0.9rem', px: 4, py: 1 }}>View</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" sx={{ py: 2 }}>No toolkit submissions yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />
      </PageSection>
    </>
  );
}
