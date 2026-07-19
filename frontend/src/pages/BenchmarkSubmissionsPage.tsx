import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';
import OwnerLabel from '../components/OwnerLabel';
import { tasksApi, benchmarksApi } from '../api';
import type { Task } from '../api';
import { useAuth } from '../context/AuthContext';
import { statusChip } from '../constants/status';
import { formatDateTime } from '../utils/datetime';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MuiLink from '@mui/material/Link';
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
import Typography from '@mui/material/Typography';

export default function BenchmarkSubmissionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  // Category variants (ARCH) submit a whole category at once, so a submission is labeled
  // by its category rather than a per-benchmark name.
  const [usesCategories, setUsesCategories] = useState(false);

  useEffect(() => {
    tasksApi.list('benchmark').then((d) => setItems(d)).catch((e) => console.error(e)).finally(() => setLoading(false));
    benchmarksApi.getFormData().then((d) => setUsesCategories(d.uses_categories)).catch(() => {});
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark' }]} />
        <PageTitle>Benchmark Submissions</PageTitle>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Use this page to submit benchmarks and review proposed benchmark entries.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <Button component={Link} to="/benchmark/submit" variant="contained" size="large">Propose a new benchmark</Button>
          <Button component={Link} to="/benchmark/info" variant="outlined" size="large" sx={{ fontSize: '1rem', px: 4 }}>Read how the system works</Button>
        </Stack>
      </PageHeader>

      <PageSection>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Proposed Benchmarks</Typography>
        <Typography variant="body1" sx={{ mb: 4 }} color="text.secondary">
          Below are all submitted benchmarks. Each is published automatically once its submission run completes, making it available for tools to run against.
        </Typography>
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{usesCategories ? 'Category' : 'Name'}</TableCell>
                {user?.is_admin && <TableCell sx={{ fontWeight: 600 }}>User</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Repository</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t) => {
                const chip = statusChip(t.status || 'Running');
                return (
                  <TableRow key={t.id} hover>
                    <TableCell>{formatDateTime(t.created_at)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                    {user?.is_admin && <TableCell sx={{ color: 'text.secondary' }}><OwnerLabel stacked name={t.user_name} email={t.user_email} /></TableCell>}
                    <TableCell sx={{ maxWidth: 260 }}>
                      {t.repository ? (
                        <MuiLink href={t.repository} target="_blank" rel="noopener" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.repository}</MuiLink>
                      ) : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell align="center"><Chip label={chip.label} color={chip.color} variant={chip.variant} size="small" /></TableCell>
                    <TableCell align="center"><Button component={Link} to={`/benchmark/submission/${t.id}`} variant="outlined" size="small" sx={{ fontSize: '0.9rem', px: 4, py: 1 }}>View</Button></TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={user?.is_admin ? 6 : 5}><Typography color="text.secondary" sx={{ py: 2 }}>No benchmark submissions yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={items.length} page={page} onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />
      </PageSection>
    </>
  );
}
