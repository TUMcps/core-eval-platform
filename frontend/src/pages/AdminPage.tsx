import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import PageBreadcrumbs from '../components/PageBreadcrumbs';

export default function AdminPage() {
  const { user } = useAuth();
  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '60vh', py: 8 }}>
      <Container>
        <PageBreadcrumbs items={[{ label: 'Admin' }]} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 800 }}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 3 }}>
              Welcome <Chip label={user?.name || user?.email} sx={{ bgcolor: 'grey.50', color: '#000', fontFamily: 'Monaco, Menlo, Consolas, monospace', fontSize: '1.6rem', height: 'auto', py: 0.5, px: 1 }} />
            </Typography>
            <Typography variant="h6" color="text.secondary">Manage your system settings and users</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'center', gap: 3 }}>
            <Button component={Link} to="/admin/users" variant="contained" size="large" sx={{ minWidth: 180 }}>Users</Button>
            <Button component={Link} to="/admin/settings" variant="contained" size="large" sx={{ minWidth: 180 }}>Settings</Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
