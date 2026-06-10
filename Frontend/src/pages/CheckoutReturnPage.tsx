import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { CheckCircle, Clock, AlertCircle, Ticket } from 'lucide-react';
import { GET_TICKET_ORDER, COMPLETE_SANDBOX_PAYMENT, RECONCILE_TICKET_ORDER } from '../graphql/ticketing';
import { formatMinor } from '../utils/money';
import PageSeo from '../components/common/PageSeo';

type OrderStatus = {
  reference: string;
  status: string;
  paymentState: string;
  totalMinor: number;
  currency: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

const CheckoutReturnPage = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') ?? '';
  // The Sandbox provider appends sandbox=1 to its return URL; the real provider
  // (Vipps) does not. This decides which completion path drives the order forward.
  const isSandbox = searchParams.get('sandbox') === '1' && import.meta.env.DEV;

  const [pollCount, setPollCount] = useState(0);
  const [sandboxDone, setSandboxDone] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [completeSandbox] = useMutation(COMPLETE_SANDBOX_PAYMENT);
  const [reconcileOrder] = useMutation(RECONCILE_TICKET_ORDER);

  const { data, loading, error, refetch } = useQuery(GET_TICKET_ORDER, {
    variables: { reference },
    skip: !reference,
    fetchPolicy: 'network-only',
  });

  const order: OrderStatus | undefined = data?.ticketOrder;
  // Backend values: paymentState Created→Authorized→Captured; order status
  // Pending→Reserved→Paid→Fulfilled (tickets issued on Captured/Fulfilled).
  const isPaid =
    order?.paymentState === 'Captured' ||
    order?.status === 'Fulfilled' ||
    order?.status === 'Paid';

  // Sandbox (dev): auto-call completeSandboxPayment once, then start polling.
  useEffect(() => {
    if (!isSandbox || !reference || sandboxDone) return;

    const run = async () => {
      try {
        await completeSandbox({ variables: { reference } });
      } catch {
        setSandboxError('Sandbox payment completion failed — check the backend.');
      } finally {
        setSandboxDone(true);
        refetch();
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSandbox, reference]);

  // Real provider (Vipps): poll-reconcile until paid or max polls reached. The
  // mutation is idempotent server-side (shares the webhook's exactly-once path),
  // so calling it on every tick is safe — it captures once the user has approved
  // in the Vipps app, and is a no-op while the payment is still pending.
  useEffect(() => {
    if (isPaid || !reference) return;

    const tick = async () => {
      if (!isSandbox) {
        try {
          await reconcileOrder({ variables: { reference } });
        } catch {
          // Transient reconcile failures are fine — the next tick retries.
        }
      }
      refetch();
    };

    if (!isSandbox) tick(); // reconcile immediately on landing, not after 2s

    intervalRef.current = setInterval(() => {
      setPollCount((prev) => {
        if (prev >= MAX_POLLS) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        tick();
        return prev + 1;
      });
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaid, reference, isSandbox]);

  // ── Missing reference ────────────────────────────────────────────────────
  if (!reference) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">No order reference</h1>
          <p className="text-gray-400 text-sm">
            We couldn't find your order. If you completed a payment please check your email for confirmation.
          </p>
          <Link
            to="/events"
            className="inline-block mt-4 px-6 py-3 rounded-full bg-orange-400 text-black text-sm font-bold hover:bg-orange-300 transition"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading / initial fetch ──────────────────────────────────────────────
  if (loading && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  // ── GraphQL error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Couldn't load order</h1>
          <p className="text-gray-400 text-sm">{error.message}</p>
          <Link to="/events" className="inline-block text-sm text-orange-400 font-semibold hover:text-orange-300 transition">
            ← Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Order Confirmation — KlubN"
        description="Your KlubN ticket order confirmation."
        canonical="/checkout/return"
      />

      <div className="max-w-xl mx-auto px-6 py-20 space-y-8">
        {isPaid ? (
          /* ── Success ── */
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
                Payment confirmed
              </h1>
              <p className="text-gray-400 text-base">
                Your ticket is on its way — check your email for the full details.
              </p>
            </div>

            {order && (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-left space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Ticket className="w-4 h-4 text-orange-400" />
                  <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400 font-semibold">
                    Order details
                  </p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Reference</span>
                  <span className="font-mono font-semibold text-white">{order.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="font-semibold text-green-400">{order.status}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                  <span className="text-gray-400">Total paid</span>
                  <span className="font-black text-orange-400">
                    {formatMinor(order.totalMinor, order.currency)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/tickets"
                className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-sm font-bold hover:from-orange-300 hover:to-orange-400 transition-all"
              >
                View My Tickets
              </Link>
              <Link
                to="/events"
                className="px-6 py-3 rounded-full border border-white/15 bg-white/[0.04] text-white text-sm font-semibold hover:border-orange-400/40 transition"
              >
                Browse Events
              </Link>
            </div>

            {isSandbox && sandboxError && (
              <p className="text-xs text-amber-400 bg-amber-400/10 rounded-xl px-4 py-3 border border-amber-400/20">
                Dev note: {sandboxError}
              </p>
            )}
          </div>
        ) : pollCount >= MAX_POLLS ? (
          /* ── Timeout / still pending ── */
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-black tracking-tight">
                Payment pending
              </h1>
              <p className="text-gray-400 text-sm">
                We haven't received confirmation yet. If you completed the payment, you'll receive a confirmation email shortly.
              </p>
            </div>
            {order && (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Reference</span>
                  <span className="font-mono text-white">{order.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment state</span>
                  <span className="text-amber-300">{order.paymentState}</span>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => { setPollCount(0); refetch(); }}
                className="px-6 py-3 rounded-full bg-orange-400 text-black text-sm font-bold hover:bg-orange-300 transition"
              >
                Check again
              </button>
              <Link
                to="/events"
                className="px-6 py-3 rounded-full border border-white/15 bg-white/[0.04] text-white text-sm font-semibold hover:border-orange-400/40 transition"
              >
                Browse Events
              </Link>
            </div>
          </div>
        ) : (
          /* ── Waiting / polling ── */
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-orange-400/10 border border-orange-400/20 flex items-center justify-center mx-auto">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-black tracking-tight">
                Confirming payment…
              </h1>
              <p className="text-gray-400 text-sm">
                This usually takes just a moment. Please don't close this page.
              </p>
            </div>
            {order && (
              <p className="text-xs text-gray-600 font-mono">ref: {order.reference}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutReturnPage;
