import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { buildTheme } from './theme';
import { competitionApi, type Branding } from './api';
import { bootBranding } from './branding';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RouteTitle from './components/RouteTitle';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ToolkitSubmissionsPage from './pages/ToolkitSubmissionsPage';
import ToolkitSubmissionPage from './pages/ToolkitSubmissionPage';
import ToolkitDetailsPage from './pages/ToolkitDetailsPage';
import ToolkitInfoPage from './pages/ToolkitInfoPage';
import BenchmarkSubmissionsPage from './pages/BenchmarkSubmissionsPage';
import BenchmarkSubmissionPage from './pages/BenchmarkSubmissionPage';
import BenchmarkDetailsPage from './pages/BenchmarkDetailsPage';
import BenchmarkInfoPage from './pages/BenchmarkInfoPage';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/AdminPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';

const p = (el: ReactNode, admin?: boolean) => <ProtectedRoute requireAdmin={admin}>{el}</ProtectedRoute>;

/** Point the browser-tab icon at the variant's favicon URL. */
function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function App() {
  const [branding, setBranding] = useState<Branding | null>(bootBranding);
  useEffect(() => {
    competitionApi.cached().then((c) => setBranding(c.presentation?.branding ?? null)).catch(() => {});
  }, []);
  useEffect(() => { if (branding?.favicon) setFavicon(branding.favicon); }, [branding?.favicon]);
  const theme = useMemo(() => buildTheme(branding?.primary_color), [branding?.primary_color]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <RouteTitle />
          {/* A column tall enough to fill the viewport, with the routes as the only part
              that grows: a page too short to fill it leaves its slack above the footer
              rather than stranding the footer mid-screen. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
            <Navbar />
            <Box component="main" sx={{ flexGrow: 1 }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                <Route path="/toolkit" element={p(<ToolkitSubmissionsPage />)} />
                <Route path="/toolkit/info" element={p(<ToolkitInfoPage />)} />
                <Route path="/toolkit/submit" element={p(<ToolkitSubmissionPage />)} />
                <Route path="/toolkit/submission/:id" element={p(<ToolkitDetailsPage />)} />

                <Route path="/benchmark" element={p(<BenchmarkSubmissionsPage />)} />
                <Route path="/benchmark/info" element={p(<BenchmarkInfoPage />)} />
                <Route path="/benchmark/submit" element={p(<BenchmarkSubmissionPage />)} />
                <Route path="/benchmark/submission/:id" element={p(<BenchmarkDetailsPage />)} />

                <Route path="/account" element={p(<AccountPage />)} />
                <Route path="/admin" element={p(<AdminPage />, true)} />
                <Route path="/admin/settings" element={p(<AdminSettingsPage />, true)} />
                <Route path="/admin/users" element={p(<AdminUsersPage />, true)} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Box>
            <Footer />
          </Box>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
