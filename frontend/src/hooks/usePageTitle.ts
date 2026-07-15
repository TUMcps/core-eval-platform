import { useEffect } from 'react';

// Brand prefix for the browser tab, e.g. "VNN-COMP". Set once the competition
// info loads (RouteTitle), read by every page's title.
let BASE = 'Eval Platform';
export function setBaseTitle(b: string) { BASE = b; }
export function getBaseTitle() { return BASE; }
export function pageTitle(title?: string | null) { return title ? `${BASE} - ${title}` : BASE; }

/** Set the tab title to `<brand> - <title>` (or just the brand when empty). */
export function usePageTitle(title?: string | null) {
  useEffect(() => { document.title = pageTitle(title); }, [title]);
}
