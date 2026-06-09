import { FormEvent, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { RESET_PASSWORD } from '../graphql/queries';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD);

  if (!email || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-white">Invalid Reset Link</h1>
          <p className="text-gray-400 text-sm">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black font-semibold text-sm"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    try {
      await resetPassword({
        variables: {
          input: { email, token, newPassword: password },
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="liquid-glass w-full max-w-md space-y-6 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Password Reset!</h1>
          <p className="text-gray-400 text-sm">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] px-4 py-3 text-sm font-semibold tracking-[0.3em] uppercase text-black"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="liquid-glass w-full max-w-md space-y-8 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Account Recovery</p>
          <h1 className="text-3xl font-bold text-white">New Password</h1>
          <p className="text-gray-400 text-sm">Choose a strong password for your account.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-600">
            Must be at least 8 characters with uppercase, lowercase, number, and special character.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] px-4 py-3 text-sm font-semibold tracking-[0.3em] uppercase text-black disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
