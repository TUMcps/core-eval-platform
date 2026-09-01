import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../src/api';

const authApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  updateProfile: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../src/api', () => ({ authApi }));

import { useAuth } from '../src/context/AuthContext';
import { AuthProvider } from '../src/context/AuthProvider';

const currentUser: User = {
  id: '1', email: 'ada@example.com', name: 'Ada', role: 'user', enabled: true,
  is_admin: false, is_organizer: false, created_at: '2026-01-01T00:00:00Z',
};

function AuthConsumer() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <div>Loading</div>;
  return (
    <div>
      <span>{user?.email ?? 'Guest'}</span>
      <button onClick={() => void login('ada@example.com', 'secret')}>Log in</button>
      <button onClick={() => void logout()}>Log out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.getCurrentUser.mockResolvedValue(null);
    authApi.logout.mockResolvedValue(undefined);
  });

  it('loads the current session and stores its user profile', async () => {
    authApi.getCurrentUser.mockResolvedValue(currentUser);
    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('auth_user') ?? 'null')).toEqual(currentUser);
  });

  it('updates state and storage after login and logout', async () => {
    authApi.login.mockResolvedValue(currentUser);
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await screen.findByText('Guest');

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith('ada@example.com', 'secret');
    expect(localStorage.getItem('auth_user')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByText('Guest')).toBeInTheDocument());
    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('clears a stale stored profile when session validation fails', async () => {
    localStorage.setItem('auth_user', JSON.stringify(currentUser));
    authApi.getCurrentUser.mockRejectedValue(new Error('Unauthorized'));
    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    expect(JSON.parse(localStorage.getItem('auth_user') ?? 'null')).toEqual(currentUser);
    expect(await screen.findByText('Guest')).toBeInTheDocument();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });
});
