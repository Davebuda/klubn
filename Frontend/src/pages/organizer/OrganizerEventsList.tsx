import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_MY_ORGANIZER_EVENTS, DELETE_EVENT_AS_ORGANIZER } from '../../graphql/queries';

type Status = 'All' | 'Published' | 'PendingApproval' | 'Rejected';

const statusBadge = (status: string) => {
  if (status === 'Published') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (status === 'PendingApproval') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};
const statusLabel = (s: string) => s === 'PendingApproval' ? 'Pending Review' : s;

const OrganizerEventsList = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Status>('All');

  const { data, loading, refetch } = useQuery(GET_MY_ORGANIZER_EVENTS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });
  const [deleteEvent, { loading: deleting }] = useMutation(DELETE_EVENT_AS_ORGANIZER);

  const allEvents: any[] = data?.myOrganizerEvents ?? [];
  const filtered = activeTab === 'All' ? allEvents : allEvents.filter((e) => e.status === activeTab);

  const tabs: Status[] = ['All', 'Published', 'PendingApproval', 'Rejected'];

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await deleteEvent({ variables: { id } });
    refetch();
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-orange-400">Organizer Portal</p>
            <h1 className="text-2xl font-bold text-white">My Events</h1>
          </div>
          <Link
            to="/organizer-dashboard/events/new"
            className="rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] px-5 py-2 text-xs font-bold uppercase tracking-widest text-black hover:opacity-90 transition"
          >
            + New Event
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs uppercase tracking-wider rounded-t transition ${
                activeTab === tab
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {statusLabel(tab)}
              <span className="ml-1.5 text-[10px] text-gray-500">
                ({tab === 'All' ? allEvents.length : allEvents.filter((e) => e.status === tab).length})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading events…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-500">No events found.</p>
            <Link to="/organizer-dashboard/events/new" className="text-sm text-orange-400 hover:text-orange-300">
              Create your first event →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((event: any) => (
              <div
                key={event.id}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition"
              >
                {/* Flyer thumbnail */}
                <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-black/40">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No image</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white truncate">{event.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.venue?.name && ` · ${event.venue.name}, ${event.venue.city}`}
                      </p>
                      <p className="text-xs text-orange-400 mt-0.5">kr {event.price}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[0.6rem] uppercase tracking-wider font-semibold ${statusBadge(event.status)}`}>
                      {statusLabel(event.status)}
                    </span>
                  </div>
                  {event.status === 'Rejected' && event.statusReason && (
                    <p className="text-xs text-red-400 mt-1.5">Reason: {event.statusReason}</p>
                  )}
                  {event.status === 'PendingApproval' && (
                    <p className="text-xs text-orange-400/70 mt-1.5">Awaiting admin approval before going live.</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 justify-center flex-shrink-0">
                  <Link
                    to={`/organizer-dashboard/events/${event.id}/edit`}
                    className="text-xs text-orange-400 hover:text-orange-300 uppercase tracking-wide"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(event.id)}
                    disabled={deleting}
                    className="text-xs text-red-400 hover:text-red-300 uppercase tracking-wide text-left"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerEventsList;
