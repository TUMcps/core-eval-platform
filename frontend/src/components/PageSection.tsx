import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { ReactNode } from 'react';

/** White content section below a PageHeader. */
export default function PageSection({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', py: { xs: 4, md: 6 }, minHeight: '40vh' }}>
      <Container>{children}</Container>
    </Box>
  );
}
