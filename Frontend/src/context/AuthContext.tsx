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
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  updateUserLocal: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMutation] = useMutation(LOGIN);
  const [registerMutation] = useMutation(REGISTER);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    if (storedToken) {
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const persistSession = (accessToken: string, refreshToken: string, account: User) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(account));
    setToken(accessToken);
    setUser(account);
  };

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
          const { accessToken, refreshToken, user: account } = data.login;
          persistSession(accessToken, refreshToken, account);
        }
      } catch (err) {
        throw extractError(err, 'Unable to login with those credentials.');
      }
    },
    [loginMutation],
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        const { data } = await registerMutation({
          variables: { email, password, fullName },
        });
        if (data?.register) {
          const { accessToken, refreshToken, user: account } = data.register;
          persistSession(accessToken, refreshToken, account);
        }
      } catch (err) {
        throw extractError(err, 'Registration failed. Please try again.');
      }
    },
    [registerMutation],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  }, []);

  // Update local user state + localStorage without re-authenticating
  const updateUserLocal = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
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
