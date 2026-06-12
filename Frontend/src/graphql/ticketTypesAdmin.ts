import { gql } from '@apollo/client';

// Admin/CoAdmin ticket-type (tier) management. Hand-written to match the inline
// resolvers in Program.cs (no codegen in this repo — see Frontend/AGENTS.md).
//
// CRITICAL — Guid args are UUID! (never ID!): HotChocolate 400s on an ID! arg
// bound to a Guid resolver param.
//
// CRITICAL — status asymmetry. The READ side (TicketTypeDto.status) is a STRING
// carrying the C# enum name: "Draft" | "OnSale" | "Paused" | "SoldOut" | "Closed".
// The WRITE side (mutation input.status) is the GraphQL ENUM TicketTypeStatus with
// SCREAMING_SNAKE values: DRAFT | ON_SALE | PAUSED | SOLD_OUT | CLOSED. The two
// directions never line up textually — use the mapping helpers below, never a
// naive toUpperCase().
//
// Money: priceMinor is integer øre (GraphQL Long). vatRate is a Decimal fraction
// (0.12 = 12%). Convert kroner ↔ øre at the form boundary only.

// ─── Shared field selection ──────────────────────────────────────────────────

const TICKET_TYPE_FIELDS = `
  id
  eventId
  name
  description
  priceMinor
  vatRate
  currency
  capacity
  quantitySold
  quantityHeld
  available
  admitCount
  minPerOrder
  maxPerOrder
  salesStart
  salesEnd
  status
  sortOrder
`;

// ─── Queries ──────────────────────────────────────────────────────────────────

// Managers (Admin/CoAdmin) see every tier for this event including Draft/hidden;
// public callers are filtered server-side. Guid arg is UUID! (never ID!).
export const GET_TICKET_TYPES_BY_EVENT = gql`
  query GetTicketTypesByEvent($eventId: UUID!) {
    ticketTypesByEvent(eventId: $eventId) {
      ${TICKET_TYPE_FIELDS}
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────────

export const CREATE_TICKET_TYPE = gql`
  mutation CreateTicketType($input: CreateTicketTypeInput!) {
    createTicketType(input: $input) {
      ${TICKET_TYPE_FIELDS}
    }
  }
`;

export const UPDATE_TICKET_TYPE = gql`
  mutation UpdateTicketType($input: UpdateTicketTypeInput!) {
    updateTicketType(input: $input) {
      ${TICKET_TYPE_FIELDS}
    }
  }
`;

// Returns Boolean. Server refuses when quantitySold > 0 — the UI also guards this.
export const DELETE_TICKET_TYPE = gql`
  mutation DeleteTicketType($id: UUID!) {
    deleteTicketType(id: $id)
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

// The string the READ side returns (C# enum .ToString()).
export type TicketTypeStatusString =
  | 'Draft'
  | 'OnSale'
  | 'Paused'
  | 'SoldOut'
  | 'Closed';

// The enum the WRITE side accepts (GraphQL TicketTypeStatus).
export type TicketTypeStatusEnum =
  | 'DRAFT'
  | 'ON_SALE'
  | 'PAUSED'
  | 'SOLD_OUT'
  | 'CLOSED';

export interface TicketTypeAdmin {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  priceMinor: number; // øre
  vatRate: number; // fraction, e.g. 0.12
  currency: string;
  capacity: number;
  quantitySold: number;
  quantityHeld: number;
  available: number;
  admitCount: number;
  minPerOrder: number;
  maxPerOrder: number;
  salesStart: string | null; // ISO
  salesEnd: string | null; // ISO
  status: TicketTypeStatusString;
  sortOrder: number;
}

export interface TicketTypesByEventData {
  ticketTypesByEvent: TicketTypeAdmin[];
}

export interface TicketTypesByEventVars {
  eventId: string;
}

export interface CreateTicketTypeInput {
  eventId: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  vatRate?: number; // omit to get backend default (0.12)
  currency?: string; // omit to get backend default (NOK)
  capacity: number;
  admitCount: number;
  minPerOrder: number;
  maxPerOrder: number;
  salesStart?: string | null;
  salesEnd?: string | null;
  status?: TicketTypeStatusEnum; // always sent explicitly by the UI
  sortOrder: number;
}

// id required; every other field optional — only supplied fields are patched.
export interface UpdateTicketTypeInput {
  id: string;
  name?: string;
  description?: string | null;
  priceMinor?: number;
  vatRate?: number;
  currency?: string;
  capacity?: number;
  admitCount?: number;
  minPerOrder?: number;
  maxPerOrder?: number;
  salesStart?: string | null;
  salesEnd?: string | null;
  status?: TicketTypeStatusEnum;
  sortOrder?: number;
}

export interface CreateTicketTypeData {
  createTicketType: TicketTypeAdmin;
}

export interface UpdateTicketTypeData {
  updateTicketType: TicketTypeAdmin;
}

export interface DeleteTicketTypeData {
  deleteTicketType: boolean;
}

// ─── Status mapping helpers (the asymmetry guard) ─────────────────────────────

// READ string (e.g. "OnSale") → WRITE enum (e.g. "ON_SALE").
const STRING_TO_ENUM: Record<TicketTypeStatusString, TicketTypeStatusEnum> = {
  Draft: 'DRAFT',
  OnSale: 'ON_SALE',
  Paused: 'PAUSED',
  SoldOut: 'SOLD_OUT',
  Closed: 'CLOSED',
};

// WRITE enum (e.g. "ON_SALE") → READ string (e.g. "OnSale").
const ENUM_TO_STRING: Record<TicketTypeStatusEnum, TicketTypeStatusString> = {
  DRAFT: 'Draft',
  ON_SALE: 'OnSale',
  PAUSED: 'Paused',
  SOLD_OUT: 'SoldOut',
  CLOSED: 'Closed',
};

export const statusStringToEnum = (s: TicketTypeStatusString): TicketTypeStatusEnum =>
  STRING_TO_ENUM[s];

export const statusEnumToString = (e: TicketTypeStatusEnum): TicketTypeStatusString =>
  ENUM_TO_STRING[e];
