import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import { usersApi } from '../api';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';

export default function AdminPage() {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    usersApi.list().then((xs) => setPending(xs.filter((u) => !u.enabled).length)).catch(() => {});
  }, []);

  const sections = [
    {
      to: '/admin/users', title: 'Users', text: 'Enable accounts and assign roles.',
      badge: pending > 0 ? `${pending} awaiting approval` : '',
    },
    {
      to: '/admin/settings', title: 'Settings', text: 'Scheduler, parallel workers, sign-up, submission rights and timeouts.',
      badge: '',
    },
  ];

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Admin' }]} />
        <PageTitle>Admin Area</PageTitle>
      </PageHeader>
      <PageSection>
        <Grid container spacing={3}>
          {sections.map((x) => (
            <Grid key={x.to} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={Link} to={x.to} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6">{x.title}</Typography>
                      {x.badge && <Chip label={x.badge} size="small" color="warning" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{x.text}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </PageSection>
    </>
  );
}
