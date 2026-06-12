import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN, REGISTER } from '../graphql/queries';
import { setAccessToken } from '../apollo-client';
import { readCsrfToken } from '../lib/csrf';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  profilePictureUrl?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoAdmin: boolean;
  isDJ: boolean;
  isOrganizer: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    acceptTerms: boolean,
    marketingOptIn?: boolean,
  ) => Promise<void>;
  logout: () => void;
  updateUserLocal: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// P0-WS3B — REST base for the cookie-bearing auth endpoints. VITE_API_URL is the GraphQL URL
// (".../graphql"); the REST surface shares the host, so strip the trailing /graphql.
const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/graphql').replace(
  /\/graphql\/?$/,
  '',
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // P0-WS3B — access token in React state (memory) only; NEVER localStorage. The refresh token is
  // an HttpOnly cookie the browser holds and JS cannot read.
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMutation] = useMutation(LOGIN);
  const [registerMutation] = useMutation(REGISTER);

  // Keep the in-memory token mirrored into apollo-client (the non-React auth link reads it there).
  const setSession = useCallback((accessToken: string | null, account: User | null) => {
    setTokenState(accessToken);
    setAccessToken(accessToken);
    setUser(account);
  }, []);

  // On mount, try to restore the session from the klubn_rt cookie via /api/auth/refresh. If the
  // cookie is valid we get a fresh access token + user back (no forced logout on reload); a 401/403
  // means logged-out. The CSRF token is read from the non-HttpOnly klubn_csrf cookie.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const csrf = readCsrfToken();
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        });
        if (!res.ok) {
          if (!cancelled) setSession(null, null);
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.accessToken && data?.user) {
          setSession(data.accessToken, data.user as User);
        } else if (!cancelled) {
          setSession(null, null);
        }
      } catch {
        if (!cancelled) setSession(null, null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  const extractError = (err: unknown, fallback: string): Error => {
    // 1. Check GraphQL errors (returned with 200 status)
    if (err && typeof err === 'object' && 'graphQLErrors' in err) {
      const gqlErrors = (err as { graphQLErrors: { message: string }[] }).graphQLErrors;
      if (gqlErrors?.length > 0 && gqlErrors[0].message) {
        return new Error(gqlErrors[0].message);
      }
    }
    // 2. Check network errors (GraphQL errors returned with non-200 status)
    if (err && typeof err === 'object' && 'networkError' in err) {
      const networkError = (err as { networkError: any }).networkError;
      // Apollo wraps server responses in networkError.result
      if (networkError?.result?.errors?.length > 0) {
        return new Error(networkError.result.errors[0].message);
      }
      if (networkError?.message) {
        return new Error(networkError.message);
      }
    }
    if (err instanceof Error) return err;
    return new Error(fallback);
  };

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { data } = await loginMutation({ variables: { email, password } });
        if (data?.login) {
          // The backend set the klubn_rt + klubn_csrf cookies; we only keep the access token + user
          // in memory. The body's refreshToken is intentionally blanked server-side (ignored here).
          const { accessToken, user: account } = data.login;
          setSession(accessToken, account);
        }
      } catch (err) {
        throw extractError(err, 'Unable to login with those credentials.');
      }
    },
    [loginMutation, setSession],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      acceptTerms: boolean,
      marketingOptIn = false,
    ) => {
      try {
        const { data } = await registerMutation({
          variables: { email, password, fullName, acceptTerms, marketingOptIn },
        });
        if (data?.register) {
          const { accessToken, user: account } = data.register;
          setSession(accessToken, account);
        }
      } catch (err) {
        throw extractError(err, 'Registration failed. Please try again.');
      }
    },
    [registerMutation, setSession],
  );

  const logout = useCallback(() => {
    // Expire the cookies server-side, then clear in-memory state regardless of the result.
    const csrf = readCsrfToken();
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    }).catch(() => {
      /* best-effort; local state is cleared either way */
    });
    setSession(null, null);
  }, [setSession]);

  // Update local user state (memory only) without re-authenticating.
  const updateUserLocal = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      updateUserLocal,
      isAuthenticated: Boolean(user),
      isAdmin:
        !!user &&
        (user.role === 'Admin' || user.email?.toLowerCase() === 'letsgoklubn@gmail.com'),
      isCoAdmin: !!user && user.role === 'CoAdmin',
      isDJ: !!user && user.role === 'DJ',
      isOrganizer: !!user && user.role === 'EventOrganizer',
    }),
    [user, token, loading, login, register, logout, updateUserLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
