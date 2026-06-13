import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Only allow returning to an internal, single-leading-slash path — never an
// absolute or protocol-relative URL (open-redirect guard).
const safeRedirect = (raw: string | null): string => {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate(safeRedirect(searchParams.get('redirect')), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login with those credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="liquid-glass w-full max-w-md space-y-8 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Access</p>
          <h1 className="text-3xl font-bold text-white">Login</h1>
          <p className="text-gray-400 text-sm">Enter your credentials to access tickets, uploads, and saved DJs.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-orange-300/70 hover:text-orange-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] px-4 py-3 text-sm font-semibold tracking-[0.3em] uppercase text-black disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Need an account?{' '}
          <Link to="/register" className="text-orange-300 underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
