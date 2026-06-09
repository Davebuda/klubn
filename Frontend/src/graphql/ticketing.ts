import { gql } from '@apollo/client';

// ─── Queries ────────────────────────────────────────────────────────────────

export const GET_TICKET_TYPES = gql`
  query GetTicketTypes($eventId: ID!) {
    ticketTypes(eventId: $eventId) {
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

// ─── Mutations ───────────────────────────────────────────────────────────────

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
