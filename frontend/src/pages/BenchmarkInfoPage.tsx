import { Link } from 'react-router-dom';
import { Typography, Button, Box, Divider } from '@mui/material';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';

export default function BenchmarkInfoPage() {
  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: 'Info' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>How benchmarks work</Typography>
        <Typography variant="body1" color="text.secondary">
          A benchmark belongs to a category and defines a list of instances that tools run against.
        </Typography>
      </PageHeader>
      <PageSection>
        <Box sx={{ maxWidth: 820 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>Structure</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Each benchmark names a set of <b>instances</b> (individual cases). An instance is passed to a
            toolkit's <code>run_instance</code> script as <code>(version, benchmark, instance)</code>. For VNN-COMP,
            an instance is an onnx network + a vnnlib property + a timeout; other competitions define their own
            per-category instance format.
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>Submitting</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Propose a benchmark (name + repository); its instances are generated from the repo. Once the run
            completes and validates, it is published automatically — selectable when submitting a toolkit, and
            organizers can group it into evaluation tracks.
          </Typography>
          <Button component={Link} to="/benchmark/submit" variant="contained" size="large">Propose a benchmark</Button>
        </Box>
      </PageSection>
    </>
  );
}
