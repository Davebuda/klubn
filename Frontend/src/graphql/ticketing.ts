import { gql } from '@apollo/client';

// ─── Queries ────────────────────────────────────────────────────────────────

// $unlockCode (nullable) reveals hidden tiers a promo with UnlocksHiddenTypes unlocks
// (design §3.2). Omitted/invalid => the public list only, no error — indistinguishable
// from passing no code (anti-oracle). Revealed tiers carry isUnlocked=true for the FE
// marker. Guid args are UUID! (never ID!).
export const GET_TICKET_TYPES = gql`
  query GetTicketTypes($eventId: UUID!, $unlockCode: String) {
    ticketTypes(eventId: $eventId, unlockCode: $unlockCode) {
      id
      name
      description
      priceMinor
      vatRate
      currency
      admitCount
      minPerOrder
      maxPerOrder
      available
      status
      sortOrder
      isUnlocked
    }
  }
`;

export const GET_TICKET_ORDER = gql`
  query GetTicketOrder($reference: String!) {
    ticketOrder(reference: $reference) {
      reference
      status
      paymentState
      totalMinor
      currency
    }
  }
`;

// Stateless, side-effect-free price of a selection (incl. promo). Anonymous-allowed.
// fetchPolicy must be network-only at the call site — a quote must never serve a stale
// total next to a changed cart. An invalid promo does NOT fail the quote: it returns
// promo.ok=false + reason with the UNDISCOUNTED totals. An invalid selection returns
// ok=false + reason. Guid args are UUID! (never ID!).
export const QUOTE_TICKET_ORDER = gql`
  query QuoteTicketOrder($input: QuoteTicketOrderInput!) {
    quoteTicketOrder(input: $input) {
      ok
      reason
      lines {
        ticketTypeId
        name
        quantity
        unitPriceMinor
        vatRate
        lineGrossMinor
        discountMinor
        lineTotalMinor
      }
      subtotalMinor
      discountMinor
      vatMinor
      totalMinor
      currency
      promo {
        code
        ok
        reason
      }
      availableProviders
    }
  }
`;

// ─── Mutations ───────────────────────────────────────────────────────────────

// $input gains optional promoCode/provider fields (the CreateTicketOrderInput shape was
// extended server-side); the document's variables are unchanged because it already takes
// a single $input object. The returned OrderSummary has no discount field — Order.total
// already reflects any discount, so the existing selection set is correct.
export const CREATE_TICKET_ORDER = gql`
  mutation CreateTicketOrder($input: CreateTicketOrderInput!) {
    createTicketOrder(input: $input) {
      order {
        reference
        lines {
          ticketTypeName
          quantity
          admitCount
          unitPriceMinor
          vatRate
          lineTotalMinor
        }
        subtotalMinor
        vatMinor
        totalMinor
        currency
      }
      redirectUrl
      provider
    }
  }
`;

// Start a NEW payment attempt on an unpaid order (owner-checked server-side). provider:
// null ⇒ backend default; otherwise an enabled-provider name. Returns the same payload
// shape as createTicketOrder — redirect the buyer to redirectUrl on success.
export const RETRY_TICKET_ORDER_PAYMENT = gql`
  mutation RetryTicketOrderPayment($reference: String!, $provider: String) {
    retryTicketOrderPayment(reference: $reference, provider: $provider) {
      order {
        reference
        subtotalMinor
        vatMinor
        totalMinor
        currency
      }
      redirectUrl
      provider
    }
  }
`;

export const COMPLETE_SANDBOX_PAYMENT = gql`
  mutation CompleteSandboxPayment($reference: String!) {
    completeSandboxPayment(reference: $reference) {
      reference
      status
      paymentState
      totalMinor
      currency
    }
  }
`;

// Real-provider (Vipps) poll-reconcile: reads the provider's live payment status and
// idempotently finalizes (capture → issue) server-side. Safe to call repeatedly —
// it shares the webhook's exactly-once path.
export const RECONCILE_TICKET_ORDER = gql`
  mutation ReconcileTicketOrder($reference: String!) {
    reconcileTicketOrder(reference: $reference) {
      reference
      status
      paymentState
      totalMinor
      currency
    }
  }
`;

// Door-scan redemption (admin/door staff only). Omitting admits redeems the whole
// ticket in one scan; admits=N supports wave entry for group tickets.
export const REDEEM_TICKET = gql`
  mutation RedeemTicket($token: String!, $admits: Int) {
    redeemTicket(token: $token, admits: $admits) {
      ticketNumber
      eventTitle
      holderName
      admittedNow
      admitsRemaining
      redeemedAt
    }
  }
`;

// ─── Types ───────────────────────────────────────────────────────────────────
// Hand-written to match the GraphQL documents above (no codegen in this repo — see
// Frontend/AGENTS.md). Money fields are minor units (øre) as number.

export interface QuoteLine {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  vatRate: number;
  lineGrossMinor: number;
  discountMinor: number;
  lineTotalMinor: number;
}

export interface QuotePromo {
  code: string;
  ok: boolean;
  reason: string | null;
}

export interface CheckoutQuote {
  ok: boolean;
  reason: string | null;
  lines: QuoteLine[];
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  totalMinor: number;
  currency: string;
  promo: QuotePromo | null;
  availableProviders: string[];
}

export interface QuoteTicketOrderData {
  quoteTicketOrder: CheckoutQuote;
}

export interface QuoteTicketOrderVars {
  input: {
    eventId: string;
    lines: { ticketTypeId: string; quantity: number }[];
    promoCode?: string | null;
  };
}

export interface RetryTicketOrderData {
  retryTicketOrderPayment: {
    order: {
      reference: string;
      subtotalMinor: number;
      vatMinor: number;
      totalMinor: number;
      currency: string;
    };
    redirectUrl: string;
    provider: string;
  };
}

export interface RetryTicketOrderVars {
  reference: string;
  provider?: string | null;
}
