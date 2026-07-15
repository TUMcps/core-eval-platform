import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !user.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
