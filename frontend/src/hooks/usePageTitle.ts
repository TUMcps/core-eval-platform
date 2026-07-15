import { useEffect } from 'react';

// Brand prefix for the browser tab, e.g. "VNN-COMP". Seeded synchronously from the
// injected branding (no flash), then confirmed once competition info loads (RouteTitle).
let BASE = window.__BRANDING__?.display_name || 'Eval Platform';
export function setBaseTitle(b: string) { BASE = b; }
export function getBaseTitle() { return BASE; }
export function pageTitle(title?: string | null) { return title ? `${BASE} - ${title}` : BASE; }

/** Set the tab title to `<brand> - <title>` (or just the brand when empty). */
export function usePageTitle(title?: string | null) {
  useEffect(() => { document.title = pageTitle(title); }, [title]);
}
