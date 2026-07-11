/**
 * AuthProvider.tsx — Global authentication state (React Island)
 * client:load — needed before any auth-gated interaction
 *
 * Uses JWT httpOnly cookie (blog_session) for auth.
 * Calls POST /api/auth/login to authenticate, POST /api/auth/logout to sign out.
 */

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";

interface AuthContextValue {
  isLoggedIn: boolean;
  username: string | null;
  login: (username: string, token: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  username: null,
  login: () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Check auth on mount via silent API call
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(true);
        setUsername(data.username);
        return;
      }
    } catch {
      // Network error — not logged in
    }

    setIsLoggedIn(false);
    setUsername(null);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((username: string, _token: string) => {
    setUsername(username);
    setIsLoggedIn(true);
    // JWT is stored in httpOnly cookie — no client-side storage needed
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors
    }
    setUsername(null);
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, username, login, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}
