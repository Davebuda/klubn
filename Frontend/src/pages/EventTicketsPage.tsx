import { useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Minus,
  Plus,
  Ticket,
  ShoppingBag,
  AlertCircle,
  Tag,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { GET_EVENT_BY_ID } from '../graphql/queries';
import {
  GET_TICKET_TYPES,
  CREATE_TICKET_ORDER,
  QUOTE_TICKET_ORDER,
} from '../graphql/ticketing';
import type {
  QuoteTicketOrderData,
  QuoteTicketOrderVars,
} from '../graphql/ticketing';
import { formatMinor } from '../utils/money';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import VippsIcon from '../components/common/VippsIcon';
import { ScrollReveal } from '../components/effects/ScrollReveal';

// Human label for a provider key. Vipps gets brand orange; everything else neutral.
const PROVIDER_LABELS: Record<string, string> = {
  Vipps: 'Vipps',
  Stripe: 'Card',
  Sandbox: 'Sandbox (dev)',
};

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

// ─── Totals row (with skeleton while the quote is in flight) ──────────────────

interface RowProps {
  label: string;
  pending?: boolean;
  children: ReactNode;
}

const Row = ({ label, pending, children }: RowProps) => (
  <div className="flex justify-between items-center text-gray-400">
    <span>{label}</span>
    {pending ? (
      <span className="inline-block h-4 w-20 rounded bg-white/10 animate-pulse" aria-hidden />
    ) : (
      <span>{children}</span>
    )}
  </div>
);

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

  // Promo: `promoDraft` is what the user is typing; `appliedPromo` is the code actually
  // sent to the quote (set on Apply, cleared on remove). The quote re-runs on either.
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoDraft, setPromoDraft] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  // Provider chosen in the picker (only shown when >1 available). null ⇒ backend default.
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

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

  // Only show OnSale tiers, sorted by sortOrder.
  // TODO(checkout-fe): hidden-tier reveal is BACKEND-GATED and deliberately out of scope
  // for this slice. A promo with UnlocksHiddenTypes=true discounts/unlocks a hidden tier
  // server-side, but GET_TICKET_TYPES never returns IsHidden tiers and the CheckoutQuote
  // DTO exposes no UnlockedTicketTypeIds — so the FE can't surface a tier the user can't
  // see. Revealing them needs a small backend read addition, e.g. ticketTypes(eventId,
  // unlockCode), that returns hidden tiers when the code unlocks them. Do NOT hack this
  // client-side. Until then: promo discounts on VISIBLE tiers work end-to-end.
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

  const hasSelection = selectedLines.length > 0;
  const needsEmail = !user;

  // ── Server-driven quote ─────────────────────────────────────────────────────
  // The cart key changes whenever quantities OR the applied promo change; we debounce
  // it (~400ms) so dragging steppers doesn't spam the backend. Totals come from the
  // quote ONLY — never client math — so prices, discounts, and VAT always match what
  // create will charge.
  const cartKey = useMemo(
    () =>
      JSON.stringify({
        lines: selectedLines.map((l) => [l.tier.id, l.qty]),
        promo: appliedPromo ?? '',
      }),
    [selectedLines, appliedPromo]
  );
  const debouncedCartKey = useDebounce(cartKey, 400);

  const [runQuote, { data: quoteData, loading: quoteLoading, error: quoteError }] =
    useLazyQuery<QuoteTicketOrderData, QuoteTicketOrderVars>(QUOTE_TICKET_ORDER, {
      fetchPolicy: 'network-only',
    });

  useEffect(() => {
    if (!id || !hasSelection) return;
    const parsed = JSON.parse(debouncedCartKey) as { lines: [string, number][]; promo: string };
    if (parsed.lines.length === 0) return;
    runQuote({
      variables: {
        input: {
          eventId: id,
          lines: parsed.lines.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
          promoCode: parsed.promo || undefined,
        },
      },
    });
  // debouncedCartKey is the single source of truth for "the cart settled"; id/hasSelection gate it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCartKey, id, hasSelection]);

  const quote = quoteData?.quoteTicketOrder;
  // The quote is "fresh" only when it reflects the CURRENT settled cart. While the live
  // cartKey differs from the debounced one (user just changed something), or a request
  // is in flight, totals are shown as a skeleton — never stale numbers next to a new cart.
  const quoteStale = cartKey !== debouncedCartKey;
  const quotePending = hasSelection && (quoteLoading || quoteStale || (!quote && !quoteError));

  const availableProviders = quote?.availableProviders ?? [];

  // Default the provider picker to the first available; reset if the chosen one vanishes.
  useEffect(() => {
    if (availableProviders.length === 0) {
      if (selectedProvider !== null) setSelectedProvider(null);
      return;
    }
    if (!selectedProvider || !availableProviders.includes(selectedProvider)) {
      setSelectedProvider(availableProviders[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableProviders.join(',')]);

  const promoResult = quote?.promo ?? null;

  const handleQtyChange = (tierId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [tierId]: qty }));
    setErrorMsg(null);
  };

  const handleApplyPromo = () => {
    const code = promoDraft.trim();
    if (!code) return;
    setAppliedPromo(code);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDraft('');
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
            promoCode: appliedPromo || undefined,
            provider: selectedProvider || undefined,
          },
        },
      });

      const payload: CreateTicketOrderPayload = data?.createTicketOrder;
      if (!payload?.redirectUrl) {
        throw new Error('No redirect URL returned from server.');
      }

      // Stash the providers available for THIS order so the return page can offer the
      // same choice on a payment retry (it has no cart context of its own).
      try {
        if (availableProviders.length > 1) {
          sessionStorage.setItem(
            `checkout:providers:${payload.order.reference}`,
            JSON.stringify(availableProviders)
          );
        }
      } catch {
        // sessionStorage may be unavailable (private mode) — retry just falls back to
        // the backend default provider, which is fine.
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

                {/* Line items — names/qty are client-known; per-line money comes from the quote. */}
                {selectedLines.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No tickets selected yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLines.map((l) => {
                      const quoteLine =
                        !quotePending && quote
                          ? quote.lines.find((ql) => ql.ticketTypeId === l.tier.id)
                          : undefined;
                      return (
                        <div key={l.tier.id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate">{l.tier.name}</p>
                            <p className="text-xs text-gray-400">
                              {l.qty} × {formatMinor(l.tier.priceMinor, currency)}
                              {l.tier.admitCount > 1 && ` · Admits ${l.tier.admitCount}`}
                            </p>
                            {quoteLine && quoteLine.discountMinor > 0 && (
                              <p className="text-xs text-green-400 font-semibold">
                                −{formatMinor(quoteLine.discountMinor, currency)} discount
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {quotePending ? (
                              <span className="inline-block h-4 w-16 rounded bg-white/10 animate-pulse" aria-hidden />
                            ) : (
                              <p className="font-bold text-white">
                                {formatMinor(
                                  quoteLine?.lineTotalMinor ?? l.lineTotal,
                                  quote?.currency ?? currency
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Promo code disclosure */}
                {hasSelection && (
                  <div className="pt-1">
                    {appliedPromo && promoResult?.ok ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-green-300 truncate">
                            {promoResult.code}
                          </span>
                          {quote && quote.discountMinor > 0 && (
                            <span className="text-xs text-green-400 font-semibold flex-shrink-0">
                              −{formatMinor(quote.discountMinor, quote.currency)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="Remove promo code"
                          onClick={handleRemovePromo}
                          className="flex-shrink-0 text-green-300/70 hover:text-green-200 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : promoOpen || appliedPromo ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={promoDraft}
                            onChange={(e) => setPromoDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyPromo();
                              }
                            }}
                            placeholder="Promo code"
                            aria-label="Promo code"
                            className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-400/60 transition uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleApplyPromo}
                            disabled={!promoDraft.trim()}
                            className="flex-shrink-0 rounded-xl border border-orange-400/40 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            Apply
                          </button>
                        </div>
                        {/* Invalid promo: backend says promo.ok=false — show the reason, keep editable. */}
                        {appliedPromo && promoResult && !promoResult.ok && !quotePending && (
                          <p className="text-xs text-red-300 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>{promoResult.reason ?? 'That code can’t be applied to this order.'}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPromoOpen(true)}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-orange-300 transition"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Have a code?
                      </button>
                    )}
                  </div>
                )}

                {/* Totals — server-driven; never client math. Skeleton while the quote settles. */}
                {hasSelection && (
                  <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
                    {quoteError ? (
                      <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-red-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>Couldn’t price your order.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            runQuote({
                              variables: {
                                input: {
                                  eventId: id,
                                  lines: selectedLines.map((l) => ({
                                    ticketTypeId: l.tier.id,
                                    quantity: l.qty,
                                  })),
                                  promoCode: appliedPromo || undefined,
                                },
                              },
                            })
                          }
                          className="flex items-center gap-1.5 self-start text-sm font-semibold text-red-100 hover:text-white transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        <Row label="Subtotal" pending={quotePending}>
                          {formatMinor(quote?.subtotalMinor ?? 0, quote?.currency ?? currency)}
                        </Row>
                        {!quotePending && quote && quote.discountMinor > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>Discount{promoResult?.ok ? ` (${promoResult.code})` : ''}</span>
                            <span>−{formatMinor(quote.discountMinor, quote.currency)}</span>
                          </div>
                        )}
                        <Row label="VAT (incl.)" pending={quotePending}>
                          {formatMinor(quote?.vatMinor ?? 0, quote?.currency ?? currency)}
                        </Row>
                        <div className="flex justify-between items-center text-base font-black text-white pt-1">
                          <span>Total</span>
                          {quotePending ? (
                            <span className="inline-block h-5 w-24 rounded bg-white/10 animate-pulse" aria-hidden />
                          ) : (
                            <span className="text-orange-400">
                              {formatMinor(quote?.totalMinor ?? 0, quote?.currency ?? currency)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Provider picker — only when the buyer actually has a choice (>1). */}
                {hasSelection && !quoteError && availableProviders.length > 1 && (
                  <fieldset className="pt-1 space-y-2">
                    <legend className="text-xs uppercase tracking-[0.3em] text-gray-400 font-semibold mb-1">
                      Betal med / Pay with
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {availableProviders.map((p) => {
                        const active = selectedProvider === p;
                        const isVipps = p === 'Vipps';
                        return (
                          <label
                            key={p}
                            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-semibold text-center transition-all ${
                              active
                                ? isVipps
                                  ? 'border-[#FF5B24]/70 bg-[#FF5B24]/15 text-[#FF8A5B]'
                                  : 'border-white/40 bg-white/10 text-white'
                                : 'border-white/15 bg-white/[0.04] text-gray-300 hover:border-white/30'
                            }`}
                          >
                            <input
                              type="radio"
                              name="payment-provider"
                              value={p}
                              checked={active}
                              onChange={() => setSelectedProvider(p)}
                              className="sr-only"
                            />
                            <span className="inline-flex items-center justify-center gap-1.5">
                              {isVipps && <VippsIcon className="h-4 w-4 rounded-[3px]" />}
                              {PROVIDER_LABELS[p] ?? p}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
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

                {/* Pay button — blocked until the order is priced (no pay on a failed/stale quote). */}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={
                    !hasSelection || submitting || allSoldOut || quotePending || !!quoteError
                  }
                  className="w-full rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] px-6 py-4 text-black text-sm font-bold tracking-wide text-center hover:from-orange-300 hover:to-orange-400 hover:shadow-[0_0_28px_rgba(255,107,53,0.45)] hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none transition-all"
                >
                  {submitting
                    ? 'Redirecting…'
                    : !hasSelection
                    ? 'Select tickets to continue'
                    : quotePending
                    ? 'Pricing your order…'
                    : 'Continue to payment'}
                </button>

                {/* Quiet trust row: official Vipps icon (icon only, per brand owner) —
                    shown only when Vipps is genuinely available for this order
                    (quote-driven), so we never advertise a provider the buyer can't use. */}
                <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-gray-600">
                  {availableProviders.includes('Vipps') && (
                    <VippsIcon className="h-3.5 w-3.5 rounded-[3px]" />
                  )}
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
