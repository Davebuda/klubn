import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_PENDING_EVENTS, APPROVE_EVENT, REJECT_EVENT } from '../../graphql/queries';

const AdminPendingEventsPage = () => {
  const { data, loading, refetch } = useQuery(GET_PENDING_EVENTS);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [approve, { loading: approving }] = useMutation(APPROVE_EVENT, {
    onCompleted: () => { refetch(); setFeedback('Event approved and is now live.'); },
  });
  const [reject, { loading: rejecting }] = useMutation(REJECT_EVENT, {
    onCompleted: () => { refetch(); setRejectingId(null); setReason(''); setFeedback('Event rejected.'); },
  });

  const events = data?.pendingEvents ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Pending Events</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review events submitted by organizers. Approved events go live immediately.
        </p>
      </header>

      {feedback && (
        <div className="rounded px-4 py-3 text-sm bg-green-500/10 border border-green-500/30 text-green-200">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No events pending approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => (
            <div key={event.id} className="card space-y-4">
              <div className="flex gap-4">
                {/* Flyer */}
                <div className="flex-shrink-0 w-24 rounded-xl overflow-hidden bg-black/40" style={{ aspectRatio: '3/4' }}>
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No flyer</div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="font-semibold text-white text-lg">{event.title}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400">{event.venue?.name}, {event.venue?.city}</p>
                  <p className="text-xs text-orange-400 font-semibold">kr {event.price}</p>
                  {event.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.genres.map((g: string) => (
                        <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400">{g}</span>
                      ))}
                    </div>
                  )}
                  {event.description && (
                    <p className="text-xs text-gray-400 line-clamp-3 mt-1">{event.description}</p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1">Organizer ID: {event.organizerId}</p>
                </div>

                <div className="flex flex-col gap-2 justify-start flex-shrink-0 pt-1">
                  <button
                    onClick={() => approve({ variables: { id: event.id } })}
                    disabled={approving}
                    className="rounded-full bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-green-500/30 transition disabled:opacity-50 whitespace-nowrap"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(event.id)}
                    className="rounded-full bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-red-500/30 transition whitespace-nowrap"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {rejectingId === event.id && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                  <p className="text-sm text-red-300 font-medium">Rejection reason</p>
                  <textarea
                    className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tell the organizer why this event was rejected…"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject({ variables: { id: event.id, reason: reason || 'Event rejected by admin.' } })}
                      disabled={rejecting}
                      className="rounded-full bg-red-500 text-white px-5 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                    >
                      {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setReason(''); }}
                      className="rounded-full border border-white/20 text-gray-300 px-5 py-1.5 text-xs uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPendingEventsPage;
