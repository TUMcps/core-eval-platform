import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { competitionApi } from '../api';
import { setBaseTitle, getBaseTitle } from '../hooks/usePageTitle';

/** Exact-path → tab title (suffix after "<brand> - "). */
const EXACT_TITLES: Record<string, string> = {
  '/': '', '/login': 'Login', '/signup': 'Sign Up',
  '/toolkit': 'Toolkit Submissions', '/toolkit/info': 'Toolkit Info', '/toolkit/submit': 'Submit Toolkit',
  '/benchmark': 'Benchmark Submissions', '/benchmark/info': 'Benchmark Info', '/benchmark/submit': 'Submit Benchmark',
  '/account': 'Account', '/admin': 'Admin', '/admin/users': 'Manage Users', '/admin/settings': 'Settings',
};

// Detail routes set their own title (name) once their data loads; skip them here.
const SELF_TITLED = ['/toolkit/submission/', '/benchmark/submission/'];

/** Keeps the browser tab title in sync with the route: "<brand> - <page>". */
export default function RouteTitle() {
  const { pathname } = useLocation();
  const [brand, setBrand] = useState(getBaseTitle());

  useEffect(() => {
    competitionApi.info().then((c) => { setBaseTitle(c.display_name); setBrand(c.display_name); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (SELF_TITLED.some((p) => pathname.startsWith(p))) return;
    const sub = pathname in EXACT_TITLES ? EXACT_TITLES[pathname] : 'Page Not Found';
    document.title = sub ? `${brand} - ${sub}` : brand;
  }, [pathname, brand]);

  return null;
}
