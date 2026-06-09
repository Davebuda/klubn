import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';
import { SUBSCRIBE_NEWSLETTER } from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';

const NewsletterSignup = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [subscribe, { loading }] = useMutation(SUBSCRIBE_NEWSLETTER);

  const buttonLabel = useMemo(() => {
    if (loading) return 'Subscribing...';
    if (status === 'success') return 'You’re in!';
    return 'Join the Newsletter';
  }, [loading, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');
    setMessage('');

    try {
      await subscribe({
        variables: {
          email,
          userId: user?.id ?? 'guest',
        },
      });
      setStatus('success');
      setMessage('Welcome! Check your inbox to confirm your subscription.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  return (
    <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-[#1a0903] via-[#0b0505] to-[#050505] p-8 space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Join Our Community</p>
        <h3 className="text-3xl font-semibold text-white">Get Exclusive Access to Events & DJ Lineups</h3>
        <p className="text-gray-400 text-sm md:text-base">
          Subscribe to receive weekly event updates, artist features, presale codes, and exclusive offers. No spam, just the best of electronic music culture.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="flex-1 px-6 py-4 rounded-full bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-orange-400 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={loading || status === 'success'}
          className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black font-semibold tracking-[0.2em] uppercase disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </form>

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </section>
  );
};

export default NewsletterSignup;
