import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    // Terms acceptance is required (also enforced server-side; this blocks an early submit).
    if (!acceptTerms) {
      setError('You must accept the terms and privacy policy to create an account.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await register(email, password, fullName, acceptTerms, marketingOptIn);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="liquid-glass w-full max-w-md space-y-8 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Join</p>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 text-sm">Unlock uploads, ticket vaults, and saved playlists with one login.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
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
              minLength={8}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
            <p className="text-[0.65rem] text-gray-500">
              Min 8 characters with uppercase, lowercase, digit, and special character.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                required
                aria-label="Accept terms and privacy policy"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-orange-400 focus:ring-orange-400"
              />
              <span>
                I accept the{' '}
                <Link to="/terms" className="text-orange-300 underline">
                  terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-orange-300 underline">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(event) => setMarketingOptIn(event.target.checked)}
                aria-label="Opt in to marketing emails (optional)"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-orange-400 focus:ring-orange-400"
              />
              <span>Send me event announcements and presale codes by email (optional).</span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading || !acceptTerms}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] px-4 py-3 text-sm font-semibold tracking-[0.3em] uppercase text-black disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-300 underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
