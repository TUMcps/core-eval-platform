import { Link } from 'react-router-dom';
import { Typography, Button, Box, Divider } from '@mui/material';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';

const STEPS = [
  ['install_tool.sh', 'Runs once on the provisioned worker to install the toolkit and its dependencies.'],
  ['prepare_instance.sh', 'Runs before each instance; a non-zero exit skips that category.'],
  ['run_instance.sh', 'Runs each instance (version, benchmark, instance) under the per-instance timeout.'],
];

export default function ToolkitInfoPage() {
  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit', to: '/toolkit' }, { label: 'Info' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>How the toolkit pipeline works</Typography>
        <Typography variant="body1" color="text.secondary">
          A toolkit submission is cloned onto a worker, installed once, then run against each selected benchmark.
        </Typography>
      </PageHeader>
      <PageSection>
        <Box sx={{ maxWidth: 820 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>The submission pipeline</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            When you submit a toolkit, the system provisions a worker (an AWS instance or a Docker container,
            depending on the deployment), clones your repository at the chosen commit, and advances through an
            ordered set of steps you can watch live on the submission's detail page: <b>create → assign worker →
            install → (optional pause) → run each benchmark → shutdown</b>.
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>Required scripts</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Your repository (or the scripts subdirectory you configure) must contain three scripts:
          </Typography>
          {STEPS.map(([name, desc]) => (
            <Box key={name} sx={{ mb: 2 }}>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{name}</Typography>
              <Typography variant="body2" color="text.secondary">{desc}</Typography>
            </Box>
          ))}
          <Divider sx={{ my: 3 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>Timeouts</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            <code>prepare_instance.sh</code> is capped at 10 minutes; <code>run_instance.sh</code> uses the
            per-instance timeout from the benchmark. A per-benchmark wall-clock cap acts as a safety net for
            tools that hang.
          </Typography>
          <Button component={Link} to="/toolkit/submit" variant="contained" size="large">Submit a toolkit</Button>
        </Box>
      </PageSection>
    </>
  );
}
