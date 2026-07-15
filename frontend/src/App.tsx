import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ToolsPage from './pages/ToolsPage';
import BenchmarksPage from './pages/BenchmarksPage';
import TasksPage from './pages/TasksPage';
import TaskDetailsPage from './pages/TaskDetailsPage';
import ScoreboardPage from './pages/ScoreboardPage';
import AdminSettingsPage from './pages/AdminSettingsPage';

const protect = (el: ReactNode, admin?: boolean) => <ProtectedRoute requireAdmin={admin}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/tools" element={protect(<ToolsPage />)} />
            <Route path="/benchmarks" element={protect(<BenchmarksPage />)} />
            <Route path="/tasks" element={protect(<TasksPage />)} />
            <Route path="/tasks/:id" element={protect(<TaskDetailsPage />)} />
            <Route path="/scoreboard" element={protect(<ScoreboardPage />)} />
            <Route path="/admin" element={protect(<AdminSettingsPage />, true)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
