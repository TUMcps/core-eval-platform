import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { ReactNode } from 'react';

/** Light-gray band at the top of every page. Wraps content in a Container. */
export default function PageHeader({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: 'grey.50', py: 6 }}>
      <Container>{children}</Container>
    </Box>
  );
}
