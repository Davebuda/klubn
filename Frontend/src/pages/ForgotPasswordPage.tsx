import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { FORGOT_PASSWORD } from '../graphql/queries';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [forgotPassword, { loading }] = useMutation(FORGOT_PASSWORD);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await forgotPassword({ variables: { email: email.trim() } });
      setSubmitted(true);
    } catch (err) {
      let message = 'Something went wrong. Please try again.';
      if (err && typeof err === 'object' && 'graphQLErrors' in err) {
        const gqlErrors = (err as { graphQLErrors: { message: string }[] }).graphQLErrors;
        if (gqlErrors?.length > 0) message = gqlErrors[0].message;
      } else if (err && typeof err === 'object' && 'networkError' in err) {
        const networkError = (err as { networkError: any }).networkError;
        if (networkError?.result?.errors?.length > 0) message = networkError.result.errors[0].message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="liquid-glass w-full max-w-md space-y-6 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Check Your Email</h1>
          <p className="text-gray-400 text-sm">
            If an account exists for <span className="text-orange-400">{email}</span>, we've sent a password reset link.
            Check your inbox and spam folder.
          </p>
          <Link to="/login" className="inline-block text-sm text-orange-300 underline hover:text-orange-200">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="liquid-glass w-full max-w-md space-y-8 rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Account Recovery</p>
          <h1 className="text-3xl font-bold text-white">Forgot Password</h1>
          <p className="text-gray-400 text-sm">Enter your email and we'll send you a link to reset your password.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-[#FF6B35] px-4 py-3 text-sm font-semibold tracking-[0.3em] uppercase text-black disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Remember your password?{' '}
          <Link to="/login" className="text-orange-300 underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
