import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import PageBreadcrumbs from '../components/PageBreadcrumbs';

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <Container sx={{ py: 6 }}>
      <PageBreadcrumbs items={[{ label: 'Account' }]} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Account</Typography>
      </Box>
      <Card sx={{ p: 3, maxWidth: 640 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">Email</Typography>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{user?.email || '—'}</Typography>
          <Typography variant="body2" color="text.secondary">Your login identifier.</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">Role</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={user?.role || '—'} color={user?.is_admin ? 'primary' : 'default'} /></Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Organizers curate tracks/benchmarks; admins have full control.</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Status</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={user?.enabled ? 'Enabled' : 'Awaiting approval'} color={user?.enabled ? 'success' : 'warning'} /></Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Enabled accounts may submit.</Typography>
        </Box>
      </Card>
    </Container>
  );
}
