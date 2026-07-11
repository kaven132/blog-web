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

  // Check auth on mount via cookie presence
  const checkAuth = useCallback(async () => {
    try {
      // Try to access a protected operation — cookie is sent automatically
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) {
        setIsLoggedIn(true);
        setUsername("admin");
        return;
      }
    } catch {
      // Not logged in
    }

    // Fallback: check if cookie exists
    const hasCookie = document.cookie.includes("blog_session");
    setIsLoggedIn(hasCookie);
    setUsername(hasCookie ? "admin" : null);
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
