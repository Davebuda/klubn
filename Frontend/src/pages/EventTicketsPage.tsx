import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, Ticket, ShoppingBag, AlertCircle } from 'lucide-react';
import { GET_EVENT_BY_ID } from '../graphql/queries';
import { GET_TICKET_TYPES, CREATE_TICKET_ORDER } from '../graphql/ticketing';
import { formatMinor } from '../utils/money';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import { ScrollReveal } from '../components/effects/ScrollReveal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketTypeAvailability {
  id: string;
  name: string;
  description?: string;
  priceMinor: number;
  vatRate: number;
  currency: string;
  admitCount: number;
  minPerOrder: number;
  maxPerOrder: number;
  available: number;
  status: string;
  sortOrder: number;
}

interface OrderLineSummary {
  ticketTypeName: string;
  quantity: number;
  admitCount: number;
  unitPriceMinor: number;
  vatRate: number;
  lineTotalMinor: number;
}

interface OrderSummary {
  reference: string;
  lines: OrderLineSummary[];
  subtotalMinor: number;
  vatMinor: number;
  totalMinor: number;
  currency: string;
}

interface CreateTicketOrderPayload {
  order: OrderSummary;
  redirectUrl: string;
  provider: string;
}

// ─── Quantity stepper ────────────────────────────────────────────────────────

interface StepperProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

const Stepper = ({ value, max, onChange, disabled }: StepperProps) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      aria-label="Decrease quantity"
      onClick={() => onChange(Math.max(0, value - 1))}
      disabled={disabled || value <= 0}
      className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.06] flex items-center justify-center text-white hover:border-orange-400/50 hover:bg-white/[0.10] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className="w-6 text-center text-sm font-bold text-white tabular-nums">{value}</span>
    <button
      type="button"
      aria-label="Increase quantity"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.06] flex items-center justify-center text-white hover:border-orange-400/50 hover:bg-white/[0.10] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ─── Ticket type card ─────────────────────────────────────────────────────────

interface TicketTypeCardProps {
  tier: TicketTypeAvailability;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
}

const TicketTypeCard = ({ tier, qty, onQtyChange }: TicketTypeCardProps) => {
  const soldOut = tier.available === 0;
  const effectiveMax = Math.min(tier.maxPerOrder, tier.available);

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
        soldOut
          ? 'border-white/[0.06] bg-white/[0.02] opacity-60'
          : qty > 0
          ? 'border-orange-400/40 bg-orange-400/[0.05]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/20'
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold text-white">{tier.name}</h3>
          {tier.admitCount > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-400/15 border border-orange-400/25 text-orange-300 text-[10px] font-bold uppercase tracking-wider">
              Admits {tier.admitCount}
            </span>
          )}
          {soldOut && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
              Sold out
            </span>
          )}
        </div>
        {tier.description && (
          <p className="text-sm text-gray-400 leading-relaxed">{tier.description}</p>
        )}
        <p className="text-lg font-black text-orange-400">
          {formatMinor(tier.priceMinor, tier.currency)}
        </p>
        {!soldOut && tier.available <= 10 && (
          <p className="text-[11px] text-amber-400 font-semibold">
            Only {tier.available} left
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        {soldOut ? (
          <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-500 text-xs font-semibold">
            Sold out
          </div>
        ) : (
          <Stepper
            value={qty}
            max={effectiveMax}
            onChange={(v) => onQtyChange(tier.id, v)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const EventTicketsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { siteSettings } = useSiteSettings();
  const defaultImage = siteSettings.defaultEventImageUrl ?? '/media/defaults/event.svg';

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: eventData, loading: eventLoading } = useQuery(GET_EVENT_BY_ID, {
    variables: { id },
    skip: !id,
  });

  const { data: tiersData, loading: tiersLoading } = useQuery(GET_TICKET_TYPES, {
    variables: { eventId: id },
    skip: !id,
  });

  const [createTicketOrder] = useMutation(CREATE_TICKET_ORDER);

  const event = eventData?.event;

  // Only show OnSale tiers, sorted by sortOrder
  const visibleTiers: TicketTypeAvailability[] = useMemo(() => {
    if (!tiersData?.ticketTypes) return [];
    return [...tiersData.ticketTypes]
      .filter((t: TicketTypeAvailability) => t.status === 'OnSale')
      .sort((a: TicketTypeAvailability, b: TicketTypeAvailability) => a.sortOrder - b.sortOrder);
  }, [tiersData]);

  const allSoldOut = visibleTiers.length > 0 && visibleTiers.every((t) => t.available === 0);

  // Build selected lines for the summary
  const selectedLines = useMemo(
    () =>
      visibleTiers
        .filter((t) => (quantities[t.id] ?? 0) > 0)
        .map((t) => ({
          tier: t,
          qty: quantities[t.id],
          lineTotal: t.priceMinor * (quantities[t.id] ?? 0),
        })),
    [visibleTiers, quantities]
  );

  const currency = visibleTiers[0]?.currency ?? 'NOK';

  const subtotalMinor = selectedLines.reduce((acc, l) => acc + l.lineTotal, 0);

  // VAT is included in the price (priceMinor already includes VAT).
  // We back-calculate the VAT component: vatComponent = price - price / (1 + vatRate)
  const vatMinor = selectedLines.reduce((acc, l) => {
    const rate = l.tier.vatRate;
    const vatPerUnit = l.tier.priceMinor - Math.round(l.tier.priceMinor / (1 + rate));
    return acc + vatPerUnit * l.qty;
  }, 0);

  const hasSelection = selectedLines.length > 0;
  const needsEmail = !user;

  const handleQtyChange = (tierId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [tierId]: qty }));
    setErrorMsg(null);
  };

  const handlePay = async () => {
    if (!hasSelection) return;
    if (needsEmail && !customerEmail.trim()) {
      setErrorMsg('Please enter your email address to continue.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const lines = selectedLines.map((l) => ({
        ticketTypeId: l.tier.id,
        quantity: l.qty,
      }));

      const { data } = await createTicketOrder({
        variables: {
          input: {
            eventId: id,
            lines,
            customerEmail: customerEmail.trim() || undefined,
          },
        },
      });

      const payload: CreateTicketOrderPayload = data?.createTicketOrder;
      if (!payload?.redirectUrl) {
        throw new Error('No redirect URL returned from server.');
      }

      // Redirect to the payment provider
      window.location.href = payload.redirectUrl;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p className="text-gray-400">Missing event id.</p>
      </div>
    );
  }

  if (eventLoading || tiersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  const heroImage = event?.imageUrl || defaultImage;

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title={event ? `Tickets — ${event.title} | KlubN` : 'Get Tickets — KlubN'}
        description={
          event
            ? `Buy tickets for ${event.title} at ${event.venue?.name ?? 'Oslo'}. Secure checkout on KlubN.`
            : 'Buy tickets securely on KlubN.'
        }
        canonical={`/events/${id}/tickets`}
        image={heroImage}
      />

      {/* ═══ Header ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt={event?.title ?? ''} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/50" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 pt-10 pb-12 min-h-[30vh] flex flex-col justify-end">
          <Link
            to={`/events/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-orange-400 transition mb-6 w-fit"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Event
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
            <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Tickets</p>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05]">
            {event?.title ?? 'Get Tickets'}
          </h1>
          {event?.venue && (
            <p className="mt-2 text-sm text-gray-400">
              {event.venue.name}, {event.venue.city}
            </p>
          )}
        </div>
      </section>

      {/* ═══ Content Grid ═══ */}
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">

          {/* ── Left: Ticket selection ── */}
          <div className="space-y-6">
            <ScrollReveal>
              <div className="flex items-center gap-3">
                <Ticket className="w-4 h-4 text-orange-400" />
                <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">
                  Select Tickets
                </p>
              </div>
            </ScrollReveal>

            {visibleTiers.length === 0 ? (
              <ScrollReveal>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center space-y-3">
                  <Ticket className="w-8 h-8 text-gray-600 mx-auto" />
                  <p className="text-gray-400 text-sm">No tickets are currently on sale for this event.</p>
                  <Link
                    to={`/events/${id}`}
                    className="inline-block text-sm text-orange-400 font-semibold hover:text-orange-300 transition"
                  >
                    ← Back to event
                  </Link>
                </div>
              </ScrollReveal>
            ) : allSoldOut ? (
              <ScrollReveal>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-base font-bold text-white">All tickets sold out</p>
                  <p className="text-sm text-gray-400">Check back later or follow us for updates.</p>
                </div>
              </ScrollReveal>
            ) : (
              <div className="space-y-3">
                {visibleTiers.map((tier, i) => (
                  <ScrollReveal key={tier.id} delay={i * 0.05}>
                    <TicketTypeCard
                      tier={tier}
                      qty={quantities[tier.id] ?? 0}
                      onQtyChange={handleQtyChange}
                    />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Order summary ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ScrollReveal>
              <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400 font-semibold">
                    Order Summary
                  </p>
                </div>

                {/* Line items */}
                {selectedLines.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No tickets selected yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLines.map((l) => (
                      <div key={l.tier.id} className="flex items-start justify-between gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{l.tier.name}</p>
                          <p className="text-xs text-gray-400">
                            {l.qty} × {formatMinor(l.tier.priceMinor, currency)}
                            {l.tier.admitCount > 1 && ` · Admits ${l.tier.admitCount}`}
                          </p>
                        </div>
                        <p className="font-bold text-white flex-shrink-0">
                          {formatMinor(l.lineTotal, currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {hasSelection && (
                  <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Subtotal</span>
                      <span>{formatMinor(subtotalMinor, currency)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>VAT (incl.)</span>
                      <span>{formatMinor(vatMinor, currency)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-white pt-1">
                      <span>Total</span>
                      <span className="text-orange-400">{formatMinor(subtotalMinor, currency)}</span>
                    </div>
                  </div>
                )}

                {/* Email for guests */}
                {needsEmail && (
                  <div className="space-y-1.5">
                    <label htmlFor="customer-email" className="text-xs uppercase tracking-[0.3em] text-gray-400 font-semibold">
                      Email for tickets
                    </label>
                    <input
                      id="customer-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="you@example.com"
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-400/60 transition"
                    />
                  </div>
                )}

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Pay button */}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={!hasSelection || submitting || allSoldOut}
                  className="w-full rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] px-6 py-4 text-black text-sm font-bold tracking-wide text-center hover:from-orange-300 hover:to-orange-400 hover:shadow-[0_0_28px_rgba(255,107,53,0.45)] hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none transition-all"
                >
                  {submitting
                    ? 'Redirecting…'
                    : hasSelection
                    ? 'Continue to payment'
                    : 'Select tickets to continue'}
                </button>

                <p className="text-center text-[10px] text-gray-600">
                  Secure checkout · No card details shared with KlubN
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EventTicketsPage;
