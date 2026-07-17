import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { ContainerProps } from '@mui/material/Container';
import type { ReactNode } from 'react';

/**
 * White content section below a PageHeader.
 *
 * `maxWidth` narrows the section's centered Container, for pages (forms, prose) that read
 * badly at full width. The header band above always keeps the app-wide width.
 */
export default function PageSection({ children, maxWidth }: { children: ReactNode; maxWidth?: ContainerProps['maxWidth'] }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', py: { xs: 4, md: 6 }, minHeight: '40vh' }}>
      <Container maxWidth={maxWidth}>{children}</Container>
    </Box>
  );
}
