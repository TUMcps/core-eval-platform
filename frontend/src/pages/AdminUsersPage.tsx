import { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Switch, MenuItem, TextField, Snackbar, Chip,
} from '@mui/material';
import { usersApi } from '../api';
import type { User } from '../api';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [toast, setToast] = useState('');

  const load = async () => setUsers(await usersApi.list());
  useEffect(() => { load().catch(() => {}); }, []);

  const patch = async (u: User, data: Partial<User>) => {
    const updated = await usersApi.update(u.id, data);
    setUsers((xs) => xs.map((x) => (x.id === u.id ? updated : x)));
    setToast('Updated');
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Users' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>Users</Typography>
        <Typography variant="body1" color="text.secondary">Enable accounts and assign roles.</Typography>
      </PageHeader>
      <PageSection>
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Enabled</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{u.name || '—'}</TableCell>
                      <TableCell>{u.email} {u.is_admin && <Chip label="admin" size="small" color="primary" sx={{ ml: 1 }} />}</TableCell>
                      <TableCell>
                        <TextField select size="small" value={u.role} onChange={(e) => patch(u, { role: e.target.value })} sx={{ minWidth: 140 }}>
                          <MenuItem value="user">user</MenuItem>
                          <MenuItem value="organizer">organizer</MenuItem>
                          <MenuItem value="admin">admin</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="center"><Switch checked={u.enabled} onChange={(e) => patch(u, { enabled: e.target.checked })} /></TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>No users.</Typography></TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
