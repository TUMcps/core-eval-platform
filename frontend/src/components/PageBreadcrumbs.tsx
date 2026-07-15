import { Link as RouterLink } from 'react-router-dom';
import type { SxProps, Theme } from '@mui/material/styles';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

export interface Crumb {
  label: string;
  /** Target route. Omit (or on the last crumb) to render as plain current-page text. */
  to?: string;
}

/**
 * Breadcrumb trail shown at the top of every page: a home icon linking to `/`,
 * followed by the given crumbs. Crumbs with a `to` render as links; the last
 * crumb always renders as plain text (the current page).
 */
export default function PageBreadcrumbs({ items, sx }: { items: Crumb[]; sx?: SxProps<Theme> }) {
  return (
    <Breadcrumbs separator="›" sx={{ mb: 3, ...sx }}>
      <MuiLink
        component={RouterLink}
        to="/"
        underline="hover"
        color="inherit"
        aria-label="Home"
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <HomeIcon fontSize="small" />
      </MuiLink>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return item.to && !isLast ? (
          <MuiLink key={i} component={RouterLink} to={item.to} underline="hover" color="inherit">
            {item.label}
          </MuiLink>
        ) : (
          <Typography key={i} color="text.primary">
            {item.label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
