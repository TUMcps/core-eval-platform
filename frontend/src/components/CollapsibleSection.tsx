import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Props {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** One expandable block inside a step (its logs, its results): shared header so the
 *  blocks stay identical, body is the caller's. */
export default function CollapsibleSection({ title, open, onToggle, children }: Props) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Box onClick={onToggle}
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', p: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
        <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <ExpandMoreIcon />
        </IconButton>
        <Typography variant="body2" fontWeight="medium">{title}</Typography>
      </Box>
      <Collapse in={open}>{children}</Collapse>
    </Box>
  );
}
