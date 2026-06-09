import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { GET_EVENTS, CREATE_EVENT_PAYMENT_INTENT, CONFIRM_STRIPE_PAYMENT } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const CheckoutForm = () => {
  const { user, isAuthenticated } = useAuth();
  const { data: eventsData, loading: eventsLoading } = useQuery(GET_EVENTS);
  const [createIntent] = useMutation(CREATE_EVENT_PAYMENT_INTENT);
  const [confirmPayment] = useMutation(CONFIRM_STRIPE_PAYMENT);

  const stripe = useStripe();
  const elements = useElements();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const events = useMemo(() => eventsData?.events ?? [], [eventsData]);
  const selectedEvent = events.find((ev: any) => ev.id === selectedEventId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingEvent = params.get('eventId');
    if (incomingEvent) {
      setSelectedEventId(incomingEvent);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!isAuthenticated || !user) {
      setStatus({ type: 'error', message: 'Please login before checking out.' });
      return;
    }
    if (!stripe || !elements) {
      setStatus({ type: 'error', message: 'Stripe is still loading. Try again.' });
      return;
    }
    if (!selectedEvent) {
      setStatus({ type: 'error', message: 'Choose an event to continue.' });
      return;
    }
    if (!termsAccepted) {
      setStatus({ type: 'error', message: 'Please accept the terms to continue.' });
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      setStatus({ type: 'error', message: 'Card element not found.' });
      return;
    }

    try {
      setProcessing(true);
      const { data } = await createIntent({
        variables: {
          eventId: selectedEventId,
          userId: user.id,
          email,
        },
      });

      const intent = data?.createEventPaymentIntent;
      if (!intent?.clientSecret) {
        throw new Error('Unable to start payment.');
      }

      const result = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: {
          card,
          billing_details: { email },
        },
      });

      if (result.error) {
        throw new Error(result.error.message || 'Payment failed.');
      }

      const paymentIntentId = result.paymentIntent?.id;
      if (!paymentIntentId) {
        throw new Error('Missing payment intent after confirmation.');
      }

      const confirmResponse = await confirmPayment({
        variables: {
          paymentIntentId,
          eventId: selectedEventId,
          userId: user.id,
          email,
        },
      });

      const ticket = confirmResponse.data?.confirmStripePaymentAndIssueTicket;
      if (!ticket) {
        throw new Error('Payment succeeded but ticket could not be issued.');
      }

      setStatus({
        type: 'success',
        message: `Payment successful! Ticket #${ticket.ticketNumber} issued for ${ticket.event.title}.`,
      });
      elements.getElement(CardElement)?.clear();
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Checkout failed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-16 space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
          <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Checkout</p>
        </div>
        <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight">Secure Payment</h1>
        <p className="text-gray-400 text-sm">Pay with Stripe. No card data touches our servers.</p>
      </div>

      {!isAuthenticated && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-100">
          Please <Link to="/login" className="underline text-orange-300">login</Link> to continue with your purchase.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 text-sm text-gray-300">
            Event
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
              disabled={eventsLoading}
            >
              <option value="">Select event</option>
              {events.map((ev: any) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} — {new Date(ev.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-gray-300">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
              required
            />
          </label>
        </div>

        {selectedEvent && (
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white">{selectedEvent.title}</p>
            <p>{new Date(selectedEvent.date).toLocaleString()}</p>
            <p className="text-orange-300 font-semibold mt-1">Total: kr {selectedEvent.price.toFixed(2)}</p>
          </div>
        )}

        <div className="space-y-2">
            <p className="text-sm text-gray-300">Card Details</p>
            <div className="rounded-lg border border-white/10 bg-black/40 p-3">
              <CardElement options={{ style: { base: { color: '#fff', fontSize: '16px' } } }} />
            </div>
          </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black/60"
          />
          I accept the terms and conditions for this purchase.
        </label>

        {status && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'bg-green-500/10 border border-green-500/40 text-green-200'
                : 'bg-red-500/10 border border-red-500/40 text-red-200'
            }`}
          >
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={!isAuthenticated || processing || !stripe}
          className="w-full rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] px-6 py-4 text-black font-bold text-sm uppercase tracking-[0.2em] disabled:opacity-50 hover:shadow-[0_0_25px_rgba(255,107,53,0.4)] hover:scale-[1.01] transition-all"
        >
          {processing ? 'Processing…' : 'Pay with Card'}
        </button>
      </form>
    </div>
    </div>
  );
};

const CheckoutPage = () => {
  if (!stripePromise) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-white">
        Stripe publishable key missing. Set VITE_STRIPE_PUBLISHABLE_KEY in your env.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
};

export default CheckoutPage;
