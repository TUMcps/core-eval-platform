import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../src/api';

interface AuthState {
  user: User | null;
  loading: boolean;
}

const useAuth = vi.hoisted(() => vi.fn<() => AuthState>());
vi.mock('../src/context/AuthContext', () => ({ useAuth }));

import { ProtectedRoute } from '../src/components/ProtectedRoute';

const user = (isAdmin = false): User => ({
  id: '1', email: 'user@example.com', name: 'User', role: isAdmin ? 'admin' : 'user',
  enabled: true, is_admin: isAdmin, is_organizer: false, created_at: '2026-01-01T00:00:00Z',
});

function renderRoute(requireAdmin = false) {
  return render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/private" element={<ProtectedRoute requireAdmin={requireAdmin}><div>Private page</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it('shows a progress indicator while authentication is loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderRoute();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('redirects signed-out users to login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    useAuth.mockReturnValue({ user: user(), loading: false });
    renderRoute();
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });

  it('redirects non-admin users away from admin routes', () => {
    useAuth.mockReturnValue({ user: user(), loading: false });
    renderRoute(true);
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('allows admins to access admin routes', () => {
    useAuth.mockReturnValue({ user: user(true), loading: false });
    renderRoute(true);
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});
