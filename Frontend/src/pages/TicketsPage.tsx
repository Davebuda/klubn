import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Users } from 'lucide-react';
import { GET_USER_TICKETS, GET_EVENTS } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';

type Ticket = {
  id: string;
  ticketNumber: string;
  totalPrice: number;
  purchaseDate: string;
  isCheckedIn: boolean;
  status: string;
  qrCode: string;
  admitCount: number;
  admitsRemaining: number;
  event: {
    id: string;
    title: string;
    date: string;
    venueName: string;
    city: string;
  };
};

const STATUS_STYLES: Record<string, string> = {
  Active: 'text-green-400',
  Used: 'text-gray-500',
  Cancelled: 'text-red-400',
  Refunded: 'text-red-300',
  Expired: 'text-amber-400',
  Transferred: 'text-blue-300',
};

type EventItem = {
  id: string;
  title: string;
  date: string;
  price: number;
  imageUrl?: string;
  ticketingUrl?: string;
  genres: string[];
  venue: { name: string; city: string };
};

// One ticket = the dark card + an expandable "entry pass" stub. The QR panel is
// deliberately WHITE — scanners need contrast, and it reads like a physical stub
// torn off the dark ticket.
const TicketCard = ({ ticket, formatter }: { ticket: Ticket; formatter: Intl.DateTimeFormat }) => {
  const [showPass, setShowPass] = useState(false);
  const isActive = ticket.status === 'Active' && !!ticket.qrCode;
  const statusLabel =
    ticket.status === 'Active' && ticket.admitsRemaining < ticket.admitCount
      ? `Active · ${ticket.admitsRemaining} of ${ticket.admitCount} admits left`
      : ticket.status;

  return (
    <div className="tile flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/3 bg-gradient-to-b from-orange-500/20 to-[#5D1725]/20 md:border-r border-white/5 p-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-orange-300">Ticket</p>
          <p className="text-white text-lg font-semibold break-words">{ticket.ticketNumber}</p>
          <p className={`text-sm font-semibold ${STATUS_STYLES[ticket.status] ?? 'text-gray-300'}`}>
            {statusLabel}
          </p>
          {ticket.admitCount > 1 && (
            <p className="flex items-center gap-1.5 text-sm text-gray-400">
              <Users className="w-4 h-4 text-orange-300" aria-hidden="true" />
              Admits {ticket.admitCount}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Purchased {formatter.format(new Date(ticket.purchaseDate))}
          </p>
        </div>
        <div className="flex-1 p-6 flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Event</p>
            <p className="text-2xl font-semibold text-white">{ticket.event.title}</p>
            <p className="text-gray-400">
              {formatter.format(new Date(ticket.event.date))} · {ticket.event.venueName}
              {ticket.event.city ? `, ${ticket.event.city}` : ''}
            </p>
            {isActive && (
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-expanded={showPass}
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-sm font-bold hover:from-orange-300 hover:to-orange-400 transition-all"
              >
                <QrCode className="w-4 h-4" aria-hidden="true" />
                {showPass ? 'Hide entry pass' : 'Show entry pass'}
              </button>
            )}
          </div>
          <div className="text-right space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Price</p>
            <p className="text-2xl font-bold text-orange-300">kr {(ticket.totalPrice ?? 0).toFixed(2)}</p>
            <Link
              to={`/events/${ticket.event.id}`}
              className="text-sm uppercase tracking-[0.3em] text-orange-200 underline"
            >
              View Event
            </Link>
          </div>
        </div>
      </div>

      {isActive && showPass && (
        // relative z-10 lifts the stub above the tile's decorative ::after sheen so
        // the QR stays pure white on hover (scan contrast).
        <div className="relative z-10 border-t border-dashed border-white/20 bg-white px-6 py-8 flex flex-col items-center gap-3">
          <QRCodeSVG value={ticket.qrCode} size={224} marginSize={2} aria-label={`Entry QR for ${ticket.ticketNumber}`} />
          <p className="font-mono text-xs text-gray-700">{ticket.ticketNumber}</p>
          <p className="text-[11px] uppercase tracking-[0.35em] text-gray-500">
            {ticket.admitCount > 1
              ? `Admits ${ticket.admitsRemaining} · show at the door`
              : 'Show at the door'}
          </p>
        </div>
      )}
    </div>
  );
};

const TicketsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_USER_TICKETS, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    fetchPolicy: 'cache-and-network',
  });
  const { data: eventsData } = useQuery(GET_EVENTS);

  const tickets = data?.ticketsByUser ?? [];

  // Upcoming events the user hasn't purchased a ticket to
  const ticketEventIds = new Set(tickets.map((t: Ticket) => t.event.id));
  const upcomingEvents: EventItem[] = useMemo(() => {
    const now = new Date();
    return (eventsData?.events ?? [])
      .filter((e: EventItem) => new Date(e.date) > now && !ticketEventIds.has(e.id))
      .sort((a: EventItem, b: EventItem) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [eventsData, ticketEventIds]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Tickets</p>
          <h1 className="text-3xl font-bold text-white">Sign in to view your passes</h1>
          <p className="text-gray-400 mt-2">
            <Link to="/login" className="text-orange-300 underline">
              Login
            </Link>{' '}
            or{' '}
            <Link to="/register" className="text-orange-300 underline">
              create an account
            </Link>{' '}
            to unlock your wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white px-6 lg:px-10 py-16">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
              <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Wallet</p>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-black text-white tracking-tight">Your Tickets</h1>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="px-6 py-3 rounded-full border border-white/20 text-sm uppercase tracking-[0.3em] hover:border-orange-400 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-4 text-sm text-red-300">
            Unable to load tickets: {error.message}
          </div>
        )}

        {!loading && !tickets.length && (
          <div className="tile px-8 py-16 text-center space-y-4">
            <p className="text-lg text-white font-semibold">No tickets yet</p>
            <p className="text-gray-400">Explore upcoming events and secure your next drop.</p>
            <Link
              to="/events"
              className="inline-flex items-center justify-center rounded-full bg-white text-black px-6 py-3 uppercase tracking-[0.3em] text-sm"
            >
              Browse Events
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {tickets.map((ticket: Ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} formatter={formatter} />
          ))}
        </div>

        {/* Upcoming Events suggestion section */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-4 pt-8 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Upcoming</p>
                <h2 className="text-xl font-semibold text-white">Events You Might Like</h2>
              </div>
              <Link
                to="/events"
                className="text-sm uppercase tracking-[0.3em] text-gray-400 hover:text-orange-300 transition-colors"
              >
                See All
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map((ev: EventItem) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  className="tile overflow-hidden group hover:border-orange-400/40 transition-colors"
                >
                  {ev.imageUrl && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={ev.imageUrl}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <p className="text-white font-semibold text-sm line-clamp-2">{ev.title}</p>
                    <p className="text-gray-400 text-xs">
                      {formatter.format(new Date(ev.date))}
                    </p>
                    <p className="text-gray-500 text-xs">{ev.venue.name}{ev.venue.city ? ` · ${ev.venue.city}` : ''}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-orange-300 text-sm font-bold">
                        {ev.price > 0 ? `kr ${ev.price.toFixed(2)}` : 'Free'}
                      </span>
                      {ev.ticketingUrl ? (
                        <span className="text-xs text-green-400 uppercase tracking-wider">Tickets Available</span>
                      ) : (
                        <span className="text-xs text-gray-500 uppercase tracking-wider">View Details</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;
