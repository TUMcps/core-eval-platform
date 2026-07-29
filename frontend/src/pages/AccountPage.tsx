import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageTitle from '../components/PageTitle';

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [workerServiceUrl, setWorkerServiceUrl] = useState(user?.worker_service_url ?? '');
  const [workerServicePort, setWorkerServicePort] = useState(user?.worker_service_port?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const nameDirty = name.trim() !== (user?.name ?? '');
  const emailDirty = email.trim() !== (user?.email ?? '');
  const workerServiceDirty = workerServiceUrl.trim() !== (user?.worker_service_url ?? '') || workerServicePort.trim() !== (user?.worker_service_port?.toString() ?? '');

  const save = async (patch: { name?: string; email?: string; worker_service_url?: string; worker_service_port?: number | null }, label: string) => {
    setSaving(true);
    try { await updateProfile(patch); setToast(label); }
    catch (e: any) { setToast(e?.response?.data?.detail ?? 'Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <Container sx={{ py: 6 }}>
      <PageBreadcrumbs items={[{ label: 'Account' }]} />
      <PageTitle variant="h4" mb={3}>Account</PageTitle>
      <Card sx={{ p: 3, maxWidth: 640 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Name</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" sx={{ flexGrow: 1, maxWidth: 360 }} />
            <Button variant="contained" size="small" disabled={!nameDirty || saving} onClick={() => save({ name: name.trim() }, 'Name updated')}>Save</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Shown across the UI as "{'{name}'} ({'{email}'})".</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Email</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" sx={{ flexGrow: 1, maxWidth: 360 }} />
            <Button variant="contained" size="small" disabled={!emailDirty || !email.trim() || saving} onClick={() => save({ email: email.trim() }, 'Email updated')}>Save</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Your login identifier.</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Worker service</Typography>
          <Stack spacing={1.5}>
            <TextField size="small" value={workerServiceUrl} onChange={(e) => setWorkerServiceUrl(e.target.value)} placeholder="lab-worker.example.com" label="Worker URL / host" />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField size="small" type="number" value={workerServicePort} onChange={(e) => setWorkerServicePort(e.target.value)} placeholder="9001" label="Port" sx={{ flexGrow: 1, maxWidth: 180 }} />
              <Button variant="contained" size="small" disabled={!workerServiceDirty || saving} onClick={() => save({ worker_service_url: workerServiceUrl.trim(), worker_service_port: workerServicePort.trim() ? Number(workerServicePort) : null }, 'Worker service updated')}>Save</Button>
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Leave blank to use the deployment default worker service.</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">Role</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={user?.role || '—'} color={user?.is_admin ? 'primary' : 'default'} /></Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Organizers curate tracks/benchmarks; admins have full control.</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">Status</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={user?.enabled ? 'Enabled' : 'Awaiting approval'} color={user?.enabled ? 'success' : 'warning'} /></Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Enabled accounts may submit.</Typography>
        </Box>
        {(() => {
          const isDocker = user?.execution_backend !== 'aws';
          const showEni = !!user?.aws_eni && !isDocker;  // ENI is an AWS concept only
          if (!user?.aws_mac && !showEni) return null;
          return (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Licensing (MAC{showEni ? ' / ENI' : ''})</Typography>
                {user?.aws_mac && <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'Monaco, Menlo, Consolas, monospace' }}>{user.aws_mac}</Typography>}
                {showEni && <Typography variant="body2" sx={{ fontFamily: 'Monaco, Menlo, Consolas, monospace', color: 'text.secondary' }}>ENI: {user!.aws_eni}</Typography>}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {isDocker
                    ? "The MAC address your submissions run with — use it for MAC-bound tool licenses. On the local Docker backend this is the container's default MAC address."
                    : 'The MAC address your submissions run with — use it for MAC-bound tool licenses. Bound to your ENI when running on AWS.'}
                </Typography>
              </Box>
            </>
          );
        })()}
      </Card>
      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} message={toast} />
    </Container>
  );
}
