import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';

export default function AdminPage() {
  return (
    <PageHeader>
      <PageBreadcrumbs items={[{ label: 'Admin' }]} />
      <PageTitle>Admin Area</PageTitle>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Button component={Link} to="/admin/users" variant="contained" size="large">Users</Button>
        <Button component={Link} to="/admin/settings" variant="contained" size="large">Settings</Button>
      </Box>
    </PageHeader>
  );
}
