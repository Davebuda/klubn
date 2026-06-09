import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  CHECK_IN_TICKET,
  DELETE_TICKET,
  GET_EVENTS,
  GET_TICKETS_BY_EVENT,
  INVALIDATE_TICKET,
  PURCHASE_TICKET,
} from '../../graphql/queries';

interface Ticket {
  id: string;
  ticketNumber: string;
  userId: string;
  totalPrice: number;
  purchaseDate: string;
  isValid: boolean;
  isCheckedIn: boolean;
}

interface TicketsQueryData {
  ticketsByEvent: Ticket[];
}

const AdminTicketsPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
  const selectClass = `${inputClass} appearance-none`;

  const { data: eventsData } = useQuery(GET_EVENTS);
  const [loadTickets, { data: ticketsData, loading: ticketsLoading }] =
    useLazyQuery<TicketsQueryData>(GET_TICKETS_BY_EVENT);

  const [purchaseTicket, { loading: purchasing }] = useMutation(PURCHASE_TICKET);
  const [checkInTicket, { loading: checkingIn }] = useMutation(CHECK_IN_TICKET);
  const [invalidateTicket, { loading: invalidating }] = useMutation(INVALIDATE_TICKET);
  const [deleteTicket, { loading: deleting }] = useMutation(DELETE_TICKET);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const events = useMemo(() => eventsData?.events ?? [], [eventsData]);
  const tickets = useMemo(() => ticketsData?.ticketsByEvent ?? [], [ticketsData]);

  useEffect(() => {
    if (selectedEventId) {
      loadTickets({ variables: { eventId: selectedEventId } });
    }
  }, [selectedEventId, loadTickets]);

  const refreshTickets = async () => {
    if (!selectedEventId) return;
    await loadTickets({ variables: { eventId: selectedEventId }, fetchPolicy: 'network-only' });
  };

  const handlePurchaseTicket = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!selectedEventId || !userIdInput.trim() || !emailInput.trim()) {
      setFeedback({ type: 'error', text: 'Event, user ID, and email are required.' });
      return;
    }

    try {
      await purchaseTicket({
        variables: {
          input: {
            eventId: selectedEventId,
            userId: userIdInput.trim(),
            email: emailInput.trim(),
            termsAccepted: true,
          },
        },
      });
      await refreshTickets();
      setUserIdInput('');
      setEmailInput('');
      setFeedback({ type: 'success', text: 'Ticket created successfully.' });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : 'Failed to create ticket.';
      setFeedback({ type: 'error', text: message });
    }
  };

  const handleTicketAction = async (
    mutation: typeof checkInTicket,
    ticketId: string,
    successMessage: string,
  ) => {
    setFeedback(null);
    try {
      await mutation({ variables: { ticketId } });
      await refreshTickets();
      setFeedback({ type: 'success', text: successMessage });
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Ticket action failed.';
      setFeedback({ type: 'error', text: message });
    }
  };

  const formatDateTime = (value: string) => new Date(value).toLocaleString();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Access Control</p>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-sm text-gray-400">
          Issue, validate, and revoke tickets per event. Select an event to view existing tickets,
          then manage scans or create new entries manually.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Event
            <select
              className={selectClass}
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">Select an event</option>
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {new Date(event.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>

          <form className="space-y-4" onSubmit={handlePurchaseTicket}>
            <div>
              <h2 className="text-lg font-semibold">Issue Ticket</h2>
              <p className="text-sm text-gray-400">
                Provide a user ID to generate a complimentary or manual ticket for the selected event.
              </p>
            </div>

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

            <label className="space-y-1 text-sm font-semibold text-gray-300">
              User ID
              <input
                type="text"
                className={inputClass}
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="User ID"
              />
            </label>

            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Email
              <input
                type="email"
                className={inputClass}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="user@example.com"
              />
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={!selectedEventId || purchasing}
            >
              Create Ticket
            </button>
          </form>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">Stats</h2>
          {selectedEventId ? (
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Total</p>
                <p className="text-3xl font-semibold">{tickets.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Checked In</p>
                <p className="text-3xl font-semibold">
                  {tickets.filter((ticket) => ticket.isCheckedIn).length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Valid</p>
                <p className="text-3xl font-semibold">
                  {tickets.filter((ticket) => ticket.isValid).length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Revoked</p>
                <p className="text-3xl font-semibold">
                  {tickets.filter((ticket) => !ticket.isValid).length}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select an event to view ticket metrics.</p>
          )}
        </div>
      </section>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tickets</h2>
            <p className="text-sm text-gray-400">Scan status, user IDs, and manual overrides.</p>
          </div>
          {selectedEventId && (
            <button
              type="button"
              className="text-xs uppercase tracking-[0.3em] text-orange-400"
              onClick={refreshTickets}
            >
              Refresh
            </button>
          )}
        </div>

        {!selectedEventId ? (
          <p className="py-6 text-center text-gray-500">Pick an event to load its tickets.</p>
        ) : ticketsLoading ? (
          <p className="py-6 text-center text-gray-500">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No tickets yet for this event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 uppercase tracking-[0.25em] text-[0.65rem]">
                  <th className="py-2">Ticket #</th>
                  <th className="py-2">User</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Purchased</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-white/5">
                    <td className="py-3 font-semibold text-white">{ticket.ticketNumber}</td>
                    <td className="py-3 text-gray-400">{ticket.userId}</td>
                    <td className="py-3 text-gray-400">
                      {ticket.isCheckedIn ? 'Checked In' : ticket.isValid ? 'Valid' : 'Invalid'}
                    </td>
                    <td className="py-3 text-gray-400">{formatDateTime(ticket.purchaseDate)}</td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-orange-400"
                        disabled={checkingIn}
                        onClick={() =>
                          handleTicketAction(checkInTicket, ticket.id, 'Ticket marked as checked in.')
                        }
                      >
                        Check In
                      </button>
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-yellow-300"
                        disabled={invalidating}
                        onClick={() =>
                          handleTicketAction(
                            invalidateTicket,
                            ticket.id,
                            'Ticket has been invalidated.',
                          )
                        }
                      >
                        Invalidate
                      </button>
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-red-400"
                        disabled={deleting}
                        onClick={() => handleTicketAction(deleteTicket, ticket.id, 'Ticket deleted.')}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTicketsPage;
