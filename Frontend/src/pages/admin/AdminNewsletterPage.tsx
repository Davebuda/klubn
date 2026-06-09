import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_NEWSLETTER_SUBSCRIBERS,
  UNSUBSCRIBE_NEWSLETTER,
} from '../../graphql/queries';

interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string;
  userId: string | null;
}

const AdminNewsletterPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';

  const { data, loading, error, refetch } = useQuery(GET_NEWSLETTER_SUBSCRIBERS);
  const [deleteSubscriber] = useMutation(UNSUBSCRIBE_NEWSLETTER);

  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const subscribers: Subscriber[] = useMemo(() => data?.newsletters ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter((s) => s.email.toLowerCase().includes(q));
  }, [subscribers, search]);

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from the newsletter?`)) return;
    try {
      await deleteSubscriber({ variables: { id } });
      await refetch();
      setFeedback({ type: 'success', text: `${email} unsubscribed.` });
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Failed to remove subscriber.' });
    }
  };

  const handleExportCSV = () => {
    const rows = [['Email', 'Subscribed At', 'User ID']];
    subscribers.forEach((s) => {
      rows.push([s.email, s.subscribedAt, s.userId || '']);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-sm text-gray-400">Loading subscribers...</div>;
  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load subscribers: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Communications</p>
        <h1 className="text-2xl font-semibold">Newsletter</h1>
        <p className="text-sm text-gray-400">
          View and manage newsletter subscribers. Export the list for external campaigns.
        </p>
      </header>

      {feedback && (
        <div
          className={`rounded px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{subscribers.length}</p>
          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-gray-500">Total Subscribers</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
          <p className="text-3xl font-bold">
            {subscribers.filter((s) => {
              const d = new Date(s.subscribedAt);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-gray-500">This Month</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
          <p className="text-3xl font-bold">
            {subscribers.filter((s) => s.userId).length}
          </p>
          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-gray-500">Registered Users</p>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          className={`${inputClass} flex-1`}
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={handleExportCSV}
          className="btn-outline whitespace-nowrap"
          disabled={subscribers.length === 0}
        >
          Export CSV
        </button>
      </div>

      {/* Subscriber table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-400 uppercase tracking-[0.25em] text-[0.65rem]">
              <th className="py-2">Email</th>
              <th className="py-2">Subscribed</th>
              <th className="py-2">User</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500">
                  {search ? 'No subscribers match your search.' : 'No subscribers yet.'}
                </td>
              </tr>
            )}
            {filtered.map((sub) => (
              <tr key={sub.id} className="border-t border-white/5">
                <td className="py-3 font-medium">{sub.email}</td>
                <td className="py-3 text-gray-400 text-xs">
                  {new Date(sub.subscribedAt).toLocaleDateString()}
                </td>
                <td className="py-3">
                  {sub.userId ? (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-green-400">
                      Registered
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Guest</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => handleDelete(sub.id, sub.email)}
                    className="text-xs uppercase tracking-wide text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminNewsletterPage;
