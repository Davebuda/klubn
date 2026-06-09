import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_DJS, GET_DJ_BY_ID } from '../../graphql/queries';
import { Calendar, MapPin, DollarSign, Clock, Users, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const DJEventsList = () => {
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const { data: djsData } = useQuery(GET_DJS);
  const { data: djData, loading } = useQuery(GET_DJ_BY_ID, {
    variables: { id: djId },
    skip: !djId,
  });

  useEffect(() => {
    if (djsData?.dJs) {
      const profile = djsData.dJs.find((dj: any) =>
        dj.userId === user?.id
      );
      if (profile) setDjId(profile.id);
    }
  }, [djsData, user]);

  const allEvents = djData?.dj?.upcomingEvents || [];
  const now = new Date();

  const upcomingEvents = allEvents.filter((event: any) => new Date(event.date) >= now);
  const pastEvents = allEvents.filter((event: any) => new Date(event.date) < now);

  const displayEvents = filter === 'upcoming' ? upcomingEvents : filter === 'past' ? pastEvents : allEvents;

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Events</h1>
          <p className="text-gray-400">All your scheduled gigs and performances</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">{allEvents.length}</div>
            <div className="text-sm text-gray-400">Total Events</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">{upcomingEvents.length}</div>
            <div className="text-sm text-gray-400">Upcoming</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">{pastEvents.length}</div>
            <div className="text-sm text-gray-400">Past Events</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 font-medium transition ${
              filter === 'upcoming'
                ? 'text-white border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 font-medium transition ${
              filter === 'past'
                ? 'text-white border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Past ({pastEvents.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium transition ${
              filter === 'all'
                ? 'text-white border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({allEvents.length})
          </button>
        </div>

        {/* Events List */}
        {displayEvents.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-2">No {filter} events</p>
            <p className="text-sm text-gray-500">
              {filter === 'upcoming'
                ? 'Your next gigs will appear here once scheduled'
                : filter === 'past'
                ? "You haven't performed at any events yet"
                : 'No events found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayEvents.map((event: any) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gradient-to-r from-purple-500/20 to-[#FF6B35]/20 border border-purple-500/30 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Need More Gigs?
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Make sure your profile is complete and showcase your unique sound to attract event organizers!
          </p>
          <Link
            to="/dj-dashboard/edit-profile"
            className="text-sm text-purple-400 hover:text-purple-300 font-medium"
          >
            Update Your Profile →
          </Link>
        </div>
      </div>
    </div>
  );
};

const EventCard = ({ event }: { event: any }) => {
  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  return (
    <div className={`bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-orange-500/30 transition ${
      isPast ? 'opacity-60' : ''
    }`}>
      {event.imageUrl && (
        <div className="h-40 overflow-hidden">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{event.title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{event.venueName}</span>
            {event.city && <span>• {event.city}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>{eventDate.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {event.price && (
            <div className="flex items-center gap-2 text-gray-400">
              <DollarSign className="w-4 h-4" />
              <span>{event.price} NOK</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          {isPast ? (
            <span className="text-sm text-gray-500">Past Event</span>
          ) : (
            <span className="text-sm text-green-400 font-medium">Upcoming</span>
          )}
          <Link
            to={`/events/${event.eventId}`}
            className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300 transition"
          >
            View Details
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DJEventsList;
