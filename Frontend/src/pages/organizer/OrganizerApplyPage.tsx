import { FormEvent, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import {
  SUBMIT_ORGANIZER_APPLICATION,
  GET_ORGANIZER_APPLICATION_BY_USER,
} from '../../graphql/queries';
import Header from '../../components/common/Header';
import { Calendar, CheckCircle, Clock } from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500';

const OrganizerApplyPage = () => {
  const { user, isAuthenticated, isOrganizer, isAdmin, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: '', description: '', website: '', socialLinks: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: appData } = useQuery(GET_ORGANIZER_APPLICATION_BY_USER, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const [submitApplication, { loading }] = useMutation(SUBMIT_ORGANIZER_APPLICATION, {
    refetchQueries: [{ query: GET_ORGANIZER_APPLICATION_BY_USER, variables: { userId: user?.id } }],
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isOrganizer || isAdmin) return <Navigate to="/organizer-dashboard" replace />;

  const existingApp = appData?.organizerApplicationByUser;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await submitApplication({
        variables: {
          input: {
            userId: user!.id,
            organizationName: form.organizationName,
            description: form.description,
            website: form.website || null,
            socialLinks: form.socialLinks || null,
          },
        },
      });
      setFeedback({ type: 'success', text: 'Application submitted! We\'ll review it and get back to you.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to submit application.' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0500] via-[#050202] to-black">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-400">Event Organizers</p>
          <h1 className="text-4xl font-bold text-white">Apply to Host Events</h1>
          <p className="text-gray-400 leading-relaxed">
            Promote your events to thousands of music fans. Once approved, you'll get your own organizer dashboard
            to create and manage events — including setting the lineup, venue, and pricing.
          </p>
        </header>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Calendar className="w-5 h-5 text-orange-400" />, title: 'List Your Events', desc: 'Publish upcoming shows and sell tickets through the platform.' },
            { icon: <CheckCircle className="w-5 h-5 text-orange-400" />, title: 'Set the Lineup', desc: 'Choose from our DJ roster or add your own artists.' },
            { icon: <Clock className="w-5 h-5 text-orange-400" />, title: 'Quick Approval', desc: 'Admin reviews within 24–48 hours of submission.' },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
              {b.icon}
              <p className="text-sm font-semibold text-white">{b.title}</p>
              <p className="text-xs text-gray-400">{b.desc}</p>
            </div>
          ))}
        </div>

        {existingApp ? (
          <div className={`rounded-2xl border p-6 space-y-3 ${
            existingApp.status === 'Pending'
              ? 'border-orange-500/30 bg-orange-500/10'
              : existingApp.status === 'Rejected'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-green-500/30 bg-green-500/10'
          }`}>
            <p className="text-sm font-semibold text-white">
              Application Status:{' '}
              <span className={
                existingApp.status === 'Pending' ? 'text-orange-400'
                : existingApp.status === 'Rejected' ? 'text-red-400'
                : 'text-green-400'
              }>
                {existingApp.status}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              Submitted {new Date(existingApp.submittedAt).toLocaleDateString()}
            </p>
            {existingApp.rejectionReason && (
              <p className="text-sm text-red-300">Reason: {existingApp.rejectionReason}</p>
            )}
            {existingApp.status === 'Approved' && (
              <div className="pt-2 border-t border-green-500/20 space-y-2">
                <p className="text-sm text-green-200">
                  Your application is approved! Log out and back in to activate your organizer access.
                </p>
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="rounded-full bg-green-500 text-black px-5 py-2 text-xs font-bold uppercase tracking-wide hover:bg-green-400 transition"
                >
                  Log out &amp; Re-login →
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-lg font-semibold text-white">Your Application</h2>

            {feedback && (
              <div className={`rounded-xl px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {feedback.text}
              </div>
            )}

            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Organization / Promoter Name *
              <input
                className={inputClass}
                required
                value={form.organizationName}
                onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))}
                placeholder="e.g. Klubn Events, Underground Collective"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Tell us about your events *
              <textarea
                className={`${inputClass} min-h-[120px]`}
                required
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What kind of events do you run? Where? How often?"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Website / Event page (optional)
              <input
                className={inputClass}
                type="url"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://yoursite.com"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Social media links (optional)
              <input
                className={inputClass}
                value={form.socialLinks}
                onChange={(e) => setForm((p) => ({ ...p, socialLinks: e.target.value }))}
                placeholder="Instagram, Facebook, etc."
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] py-3 text-sm font-bold uppercase tracking-widest text-black hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default OrganizerApplyPage;
