import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api';
import type { User } from '../api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Persist the last-known user so a reload renders the correct auth state on the
// first paint (no logged-out flash) while the /api/auth/me/ call re-confirms it.
// Only non-sensitive profile fields — the session cookie remains the real gate.
const STORAGE_KEY = 'auth_user';
function readStoredUser(): User | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as User) : null; } catch { return null; }
}
function writeStoredUser(u: User | null) {
  try { if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); else localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(readStoredUser());
  const [loading, setLoading] = useState(true);

  const setUser = (u: User | null) => { writeStoredUser(u); setUserState(u); };

  const refreshUser = async () => {
    try {
      setUser(await authApi.getCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshUser(); }, []);

  const login = async (email: string, password: string) => { setUser(await authApi.login(email, password)); };
  const signup = async (name: string, email: string, password: string) => { await authApi.signup(name, email, password); };
  const updateProfile = async (data: { name?: string; email?: string }) => { setUser(await authApi.updateProfile(data)); };
  const logout = async () => { await authApi.logout(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, updateProfile, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
