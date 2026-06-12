import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { GET_EVENTS } from '../../graphql/queries';
import {
  CREATE_TICKET_TYPE,
  DELETE_TICKET_TYPE,
  GET_TICKET_TYPES_BY_EVENT,
  UPDATE_TICKET_TYPE,
  statusEnumToString,
  type CreateTicketTypeData,
  type CreateTicketTypeInput,
  type DeleteTicketTypeData,
  type TicketTypeAdmin,
  type TicketTypeStatusEnum,
  type TicketTypeStatusString,
  type TicketTypesByEventData,
  type TicketTypesByEventVars,
  type UpdateTicketTypeData,
  type UpdateTicketTypeInput,
} from '../../graphql/ticketTypesAdmin';

// Status the radio group can produce on the form. We never expose SoldOut as a
// manual choice (it is a derived/quick-action state); the spec's radio set is
// Draft / OnSale / Paused / Closed.
type FormStatusEnum = Extract<
  TicketTypeStatusEnum,
  'DRAFT' | 'ON_SALE' | 'PAUSED' | 'CLOSED'
>;

const STATUS_RADIO: { value: FormStatusEnum; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ON_SALE', label: 'OnSale' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'CLOSED', label: 'Closed' },
];

// Color-coded status badge classes keyed by the READ-side string.
const STATUS_BADGE: Record<TicketTypeStatusString, string> = {
  Draft: 'bg-gray-500/15 border border-gray-500/30 text-gray-300',
  OnSale: 'bg-green-500/15 border border-green-500/30 text-green-200',
  Paused: 'bg-amber-500/15 border border-amber-500/30 text-amber-200',
  SoldOut: 'bg-red-500/15 border border-red-500/30 text-red-200',
  Closed: 'bg-white/5 border border-white/10 text-gray-500',
};

interface TierFormState {
  name: string;
  description: string;
  priceKr: string; // kroner string in the input; converted to øre on submit
  capacity: string;
  admitCount: string;
  minPerOrder: string;
  maxPerOrder: string;
  sortOrder: string;
  salesStart: string; // datetime-local value, '' = unset
  salesEnd: string;
  status: FormStatusEnum | ''; // '' on create = nothing picked yet (anti-footgun)
}

const emptyForm: TierFormState = {
  name: '',
  description: '',
  priceKr: '0',
  capacity: '0',
  admitCount: '1',
  minPerOrder: '1',
  maxPerOrder: '10',
  sortOrder: '0',
  salesStart: '',
  salesEnd: '',
  status: '',
};

const oreToKr = (ore: number) => (ore / 100).toFixed(2);
const krToOre = (kr: string) => Math.round(parseFloat(kr) * 100);

// ISO → value the datetime-local input expects (YYYY-MM-DDTHH:mm), local time.
const isoToLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

// datetime-local value → ISO (or null when empty).
const localInputToIso = (v: string): string | null =>
  v ? new Date(v).toISOString() : null;

const AdminTicketTypesPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
  const selectClass = `${inputClass} appearance-none`;
  const textareaClass = `${inputClass} min-h-[80px]`;

  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedEventId = searchParams.get('eventId') ?? '';

  const { data: eventsData } = useQuery(GET_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId);

  const {
    data: tiersData,
    loading: tiersLoading,
    refetch,
  } = useQuery<TicketTypesByEventData, TicketTypesByEventVars>(GET_TICKET_TYPES_BY_EVENT, {
    variables: { eventId: selectedEventId },
    skip: !selectedEventId,
    fetchPolicy: 'cache-and-network',
  });

  const [createTicketType, { loading: creating }] =
    useMutation<CreateTicketTypeData>(CREATE_TICKET_TYPE);
  const [updateTicketType, { loading: saving }] =
    useMutation<UpdateTicketTypeData>(UPDATE_TICKET_TYPE);
  const [deleteTicketType, { loading: deleting }] =
    useMutation<DeleteTicketTypeData>(DELETE_TICKET_TYPE);

  const [form, setForm] = useState<TierFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GET_EVENTS is untyped (shared query, no codegen)
  const events: any[] = useMemo(() => eventsData?.events ?? [], [eventsData]);
  const tiers = useMemo<TicketTypeAdmin[]>(
    () => tiersData?.ticketTypesByEvent ?? [],
    [tiersData],
  );

  // Editing row context — used for the capacity ≥ sold + held client check on edit.
  const editingRow = useMemo(
    () => (editingId ? tiers.find((t) => t.id === editingId) ?? null : null),
    [editingId, tiers],
  );

  // Keep the ?eventId= query param in sync with the picker.
  const onSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setEditingId(null);
    setForm(emptyForm);
    setFeedback(null);
    const next = new URLSearchParams(searchParams);
    if (id) next.set('eventId', id);
    else next.delete('eventId');
    setSearchParams(next, { replace: true });
  };

  // If the URL is the source (deep link), adopt it on mount/param change.
  useEffect(() => {
    if (preselectedEventId && preselectedEventId !== selectedEventId) {
      setSelectedEventId(preselectedEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedEventId]);

  const hasOnSaleTier = useMemo(
    () => tiers.some((t) => t.status === 'OnSale'),
    [tiers],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (tier: TicketTypeAdmin) => {
    setEditingId(tier.id);
    setFeedback(null);
    // Map the READ string back to the radio enum where possible. SoldOut has no
    // radio option — fall back to Paused so the user must consciously re-pick.
    const radioStatus: FormStatusEnum =
      tier.status === 'OnSale'
        ? 'ON_SALE'
        : tier.status === 'Paused'
        ? 'PAUSED'
        : tier.status === 'Closed'
        ? 'CLOSED'
        : tier.status === 'SoldOut'
        ? 'PAUSED'
        : 'DRAFT';
    setForm({
      name: tier.name,
      description: tier.description ?? '',
      priceKr: oreToKr(tier.priceMinor),
      capacity: String(tier.capacity),
      admitCount: String(tier.admitCount),
      minPerOrder: String(tier.minPerOrder),
      maxPerOrder: String(tier.maxPerOrder),
      sortOrder: String(tier.sortOrder),
      salesStart: isoToLocalInput(tier.salesStart),
      salesEnd: isoToLocalInput(tier.salesEnd),
      status: radioStatus,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Client-side validation mirroring server rules with friendlier copy.
  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (form.status === '') return 'Pick a status before saving.';

    const price = parseFloat(form.priceKr);
    if (Number.isNaN(price) || price < 0) return 'Price must be zero or more.';

    const capacity = parseInt(form.capacity, 10);
    if (Number.isNaN(capacity) || capacity < 0) return 'Capacity must be zero or more.';

    const admit = parseInt(form.admitCount, 10);
    if (Number.isNaN(admit) || admit < 1) return 'Admit count must be at least 1.';

    const minPer = parseInt(form.minPerOrder, 10);
    if (Number.isNaN(minPer) || minPer < 1) return 'Min per order must be at least 1.';

    const maxPer = parseInt(form.maxPerOrder, 10);
    if (Number.isNaN(maxPer) || maxPer < minPer)
      return 'Max per order must be greater than or equal to min per order.';

    if (editingRow && capacity < editingRow.quantitySold + editingRow.quantityHeld) {
      return `Capacity cannot be below already sold + held (${
        editingRow.quantitySold + editingRow.quantityHeld
      }).`;
    }

    if (form.salesStart && form.salesEnd) {
      if (new Date(form.salesEnd) <= new Date(form.salesStart))
        return 'Sales end must be after sales start.';
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!selectedEventId) {
      setFeedback({ type: 'error', text: 'Select an event first.' });
      return;
    }

    const validationError = validate();
    if (validationError) {
      setFeedback({ type: 'error', text: validationError });
      return;
    }

    // status === '' is excluded by validate(); the cast is safe here.
    const statusEnum = form.status as FormStatusEnum;

    try {
      if (editingId) {
        const input: UpdateTicketTypeInput = {
          id: editingId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          priceMinor: krToOre(form.priceKr),
          capacity: parseInt(form.capacity, 10),
          admitCount: parseInt(form.admitCount, 10),
          minPerOrder: parseInt(form.minPerOrder, 10),
          maxPerOrder: parseInt(form.maxPerOrder, 10),
          sortOrder: parseInt(form.sortOrder, 10) || 0,
          salesStart: localInputToIso(form.salesStart),
          salesEnd: localInputToIso(form.salesEnd),
          status: statusEnum,
        };
        await updateTicketType({ variables: { input } });
        setFeedback({ type: 'success', text: 'Tier updated.' });
      } else {
        const input: CreateTicketTypeInput = {
          eventId: selectedEventId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          priceMinor: krToOre(form.priceKr),
          capacity: parseInt(form.capacity, 10),
          admitCount: parseInt(form.admitCount, 10),
          minPerOrder: parseInt(form.minPerOrder, 10),
          maxPerOrder: parseInt(form.maxPerOrder, 10),
          sortOrder: parseInt(form.sortOrder, 10) || 0,
          salesStart: localInputToIso(form.salesStart),
          salesEnd: localInputToIso(form.salesEnd),
          status: statusEnum,
        };
        await createTicketType({ variables: { input } });
        setFeedback({ type: 'success', text: 'Tier created.' });
      }
      await refetch();
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save tier.';
      setFeedback({ type: 'error', text: message });
    }
  };

  // Quick status transition (Pause / Activate / Close) via the patch mutation.
  const quickStatus = async (tier: TicketTypeAdmin, status: TicketTypeStatusEnum) => {
    setFeedback(null);
    try {
      await updateTicketType({ variables: { input: { id: tier.id, status } } });
      await refetch();
      setFeedback({
        type: 'success',
        text: `"${tier.name}" set to ${statusEnumToString(status)}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status change failed.';
      setFeedback({ type: 'error', text: message });
    }
  };

  const handleDelete = async (tier: TicketTypeAdmin) => {
    if (tier.quantitySold > 0) return; // button is disabled, belt-and-braces
    if (!confirm(`Delete tier "${tier.name}"? This cannot be undone.`)) return;
    setFeedback(null);
    try {
      await deleteTicketType({ variables: { id: tier.id } });
      await refetch();
      if (editingId === tier.id) resetForm();
      setFeedback({ type: 'success', text: 'Tier deleted.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed.';
      setFeedback({ type: 'error', text: message });
    }
  };

  const formatKr = (ore: number) =>
    `kr ${(ore / 100).toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Ticketing</p>
        <h1 className="text-2xl font-semibold">Ticket Types</h1>
        <p className="text-sm text-gray-400">
          Manage the price tiers buyers can purchase for an event. Only OnSale tiers are
          visible and buyable on the public event page.
        </p>
      </header>

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

      <section className="card space-y-4">
        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Event
          <select
            className={selectClass}
            value={selectedEventId}
            onChange={(e) => onSelectEvent(e.target.value)}
          >
            <option value="">Select an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedEventId && !tiersLoading && !hasOnSaleTier && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">This event has no OnSale tiers.</p>
          <p className="mt-1 text-amber-200/80">
            The public event page is showing “No tickets are currently on sale” right now.
            Set at least one tier to OnSale to start selling.
          </p>
        </div>
      )}

      {selectedEventId && (
        <form className="card space-y-4" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Tier' : 'New Tier'}</h2>
            <p className="text-sm text-gray-400">
              {editingId
                ? 'Update this tier. Only the fields you change are saved.'
                : 'Add a new price tier for the selected event.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Name
              <input
                type="text"
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Price (kr)
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                  kr
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} pl-9`}
                  value={form.priceKr}
                  onChange={(e) => setForm((p) => ({ ...p, priceKr: e.target.value }))}
                />
              </div>
            </label>
          </div>

          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Description (Optional)
            <textarea
              className={textareaClass}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Capacity
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Admit / ticket
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.admitCount}
                onChange={(e) => setForm((p) => ({ ...p, admitCount: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Min / order
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.minPerOrder}
                onChange={(e) => setForm((p) => ({ ...p, minPerOrder: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Max / order
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.maxPerOrder}
                onChange={(e) => setForm((p) => ({ ...p, maxPerOrder: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Sort order
              <input
                type="number"
                className={inputClass}
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Sales start (Optional)
              <input
                type="datetime-local"
                className={inputClass}
                value={form.salesStart}
                onChange={(e) => setForm((p) => ({ ...p, salesStart: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Sales end (Optional)
              <input
                type="datetime-local"
                className={inputClass}
                value={form.salesEnd}
                onChange={(e) => setForm((p) => ({ ...p, salesEnd: e.target.value }))}
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-300">Status</legend>
            <div className="flex flex-wrap gap-3">
              {STATUS_RADIO.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="tier-status"
                    className="accent-orange-500"
                    value={value}
                    checked={form.status === value}
                    onChange={() => setForm((p) => ({ ...p, status: value }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Draft tiers are invisible to buyers. Only OnSale tiers can be purchased.
            </p>
          </fieldset>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={creating || saving}>
              {editingId ? 'Save Changes' : 'Create Tier'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tiers</h2>
            <p className="text-sm text-gray-400">
              Status, pricing, and inventory for the selected event.
            </p>
          </div>
          {selectedEventId && (
            <button
              type="button"
              className="text-xs uppercase tracking-[0.3em] text-orange-400"
              onClick={() => refetch()}
            >
              Refresh
            </button>
          )}
        </div>

        {!selectedEventId ? (
          <p className="py-6 text-center text-gray-500">Pick an event to load its tiers.</p>
        ) : tiersLoading && tiers.length === 0 ? (
          <p className="py-6 text-center text-gray-500">Loading tiers…</p>
        ) : tiers.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No tiers yet for this event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 uppercase tracking-[0.25em] text-[0.65rem]">
                  <th className="py-2">Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Cap</th>
                  <th className="py-2 text-right">Sold</th>
                  <th className="py-2 text-right">Held</th>
                  <th className="py-2 text-right">Avail</th>
                  <th className="py-2 text-right">Min–Max</th>
                  <th className="py-2 text-right">Sort</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-white/5 align-top">
                    <td className="py-3 font-semibold text-white">
                      {tier.name}
                      {tier.description && (
                        <span
                          className="block text-xs font-normal text-gray-500"
                          title={tier.description}
                        >
                          {tier.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ${
                          STATUS_BADGE[tier.status]
                        }`}
                      >
                        {tier.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-300">{formatKr(tier.priceMinor)}</td>
                    <td className="py-3 text-right text-gray-400">{tier.capacity}</td>
                    <td className="py-3 text-right text-gray-400">{tier.quantitySold}</td>
                    <td className="py-3 text-right text-gray-400">{tier.quantityHeld}</td>
                    <td className="py-3 text-right text-gray-400">{tier.available}</td>
                    <td className="py-3 text-right text-gray-400">
                      {tier.minPerOrder}–{tier.maxPerOrder}
                    </td>
                    <td className="py-3 text-right text-gray-400">{tier.sortOrder}</td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                        <button
                          type="button"
                          className="text-xs uppercase tracking-wide text-orange-400"
                          onClick={() => startEdit(tier)}
                        >
                          Edit
                        </button>
                        {tier.status === 'OnSale' && (
                          <button
                            type="button"
                            className="text-xs uppercase tracking-wide text-amber-300"
                            disabled={saving}
                            onClick={() => quickStatus(tier, 'PAUSED')}
                          >
                            Pause
                          </button>
                        )}
                        {(tier.status === 'Draft' || tier.status === 'Paused') && (
                          <button
                            type="button"
                            className="text-xs uppercase tracking-wide text-green-400"
                            disabled={saving}
                            onClick={() => quickStatus(tier, 'ON_SALE')}
                          >
                            Activate
                          </button>
                        )}
                        {tier.status !== 'Closed' && (
                          <button
                            type="button"
                            className="text-xs uppercase tracking-wide text-gray-400"
                            disabled={saving}
                            onClick={() => quickStatus(tier, 'CLOSED')}
                          >
                            Close
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs uppercase tracking-wide text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={deleting || tier.quantitySold > 0}
                          title={
                            tier.quantitySold > 0
                              ? 'Cannot delete a tier that has sold tickets.'
                              : undefined
                          }
                          onClick={() => handleDelete(tier)}
                        >
                          Delete
                        </button>
                      </div>
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

export default AdminTicketTypesPage;
