import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
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

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <RouteTitle />
          <Navbar />
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
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
