import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api';
import type { User } from '../api';
import { AuthContext } from './AuthContext';

const STORAGE_KEY = 'auth_user';

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: User | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is only an optimization; authentication uses the session cookie.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(readStoredUser());
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser: User | null) => {
    writeStoredUser(nextUser);
    setUserState(nextUser);
  };

  const refreshUser = async () => {
    try {
      setUser(await authApi.getCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    authApi.getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (email: string, password: string) => { setUser(await authApi.login(email, password)); };
  const signup = async (name: string, email: string, password: string) => { await authApi.signup(name, email, password); };
  const updateProfile = async (data: { name?: string; email?: string; worker_service_url?: string; worker_service_port?: number | null }) => { setUser(await authApi.updateProfile(data)); };
  const logout = async () => { await authApi.logout(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, updateProfile, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
