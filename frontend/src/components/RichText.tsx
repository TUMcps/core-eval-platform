import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import MuiLink from '@mui/material/Link';

/** The inline markup guide prose may use: `code` spans and [label](url) links. */
const TOKEN = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;

/** An in-app route. A /api/… resource is a download, not a route, and must not be routed. */
const isRoute = (url: string) => url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/api/');

/** A code span inside prose, matching the <code> the detail pages already use. */
function Code({ children }: { children: ReactNode }) {
  return (
    <Box component="code" sx={{ px: 0.6, py: 0.2, mx: '1px', borderRadius: 0.5, bgcolor: 'grey.100',
      fontFamily: 'Monaco, Consolas, monospace', fontSize: '0.875em' }}>
      {children}
    </Box>
  );
}

/**
 * A line of guide prose with its inline markup resolved.
 *
 * The copy comes from the active competition's plugin rather than from a user, so the
 * markup is trusted — it is still parsed into elements rather than set as HTML, which
 * keeps that trust from being load-bearing.
 */
export default function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      out.push(<Code>{m[1]}</Code>);
    } else {
      const [, , label, url] = m;
      out.push(isRoute(url)
        ? <MuiLink component={RouterLink} to={url}>{label}</MuiLink>
        : <MuiLink href={url} target="_blank" rel="noopener noreferrer">{label}</MuiLink>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}
