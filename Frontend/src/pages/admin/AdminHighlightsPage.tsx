import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  ALL_HIGHLIGHTS,
  CREATE_EVENT_HIGHLIGHT,
  UPDATE_EVENT_HIGHLIGHT,
  SET_HIGHLIGHT_PUBLISHED,
  DELETE_EVENT_HIGHLIGHT,
  GET_EVENTS,
} from '../../graphql/queries';

interface HighlightItem {
  id: string;
  eventId: string;
  eventTitle: string | null;
  eventDate: string;
  title: string;
  blurb: string | null;
  coverImageUrl: string;
  coverVideoUrl: string | null;
  highlightDate: string;
  upcomingEventId: string | null;
  upcomingEventTitle: string | null;
  isPublished: boolean;
  sortOrder: number;
}

interface EventOption {
  id: string;
  title: string;
}

interface FormState {
  eventId: string;
  title: string;
  blurb: string;
  coverImageUrl: string;
  coverVideoUrl: string;
  highlightDate: string;
  upcomingEventId: string;
  isPublished: boolean;
  sortOrder: number;
}

const emptyForm: FormState = {
  eventId: '',
  title: '',
  blurb: '',
  coverImageUrl: '',
  coverVideoUrl: '',
  highlightDate: '',
  upcomingEventId: '',
  isPublished: false,
  sortOrder: 0,
};

// Format an ISO datetime into the yyyy-MM-dd value a date input expects.
const toDateInput = (value: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const AdminHighlightsPage = () => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, loading, error, refetch } = useQuery(ALL_HIGHLIGHTS);
  const { data: eventsData } = useQuery(GET_EVENTS);
  const [createHighlight] = useMutation(CREATE_EVENT_HIGHLIGHT);
  const [updateHighlight] = useMutation(UPDATE_EVENT_HIGHLIGHT);
  const [setHighlightPublished] = useMutation(SET_HIGHLIGHT_PUBLISHED);
  const [deleteHighlight] = useMutation(DELETE_EVENT_HIGHLIGHT);

  const highlights: HighlightItem[] = useMemo(() => data?.allHighlights ?? [], [data]);
  const events: EventOption[] = useMemo(() => eventsData?.events ?? [], [eventsData]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: HighlightItem) => {
    setForm({
      eventId: item.eventId,
      title: item.title,
      blurb: item.blurb ?? '',
      coverImageUrl: item.coverImageUrl,
      coverVideoUrl: item.coverVideoUrl ?? '',
      highlightDate: toDateInput(item.highlightDate),
      upcomingEventId: item.upcomingEventId ?? '',
      isPublished: item.isPublished,
      sortOrder: item.sortOrder,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.eventId) {
      setFeedback({ type: 'error', text: 'Please select an event.' });
      return;
    }
    if (!form.title.trim()) {
      setFeedback({ type: 'error', text: 'Title is required.' });
      return;
    }
    if (!form.coverImageUrl.trim()) {
      setFeedback({ type: 'error', text: 'Cover image URL is required.' });
      return;
    }

    const highlightDateIso = form.highlightDate ? new Date(form.highlightDate).toISOString() : null;

    try {
      if (editingId) {
        await updateHighlight({
          variables: {
            id: editingId,
            input: {
              title: form.title,
              blurb: form.blurb || null,
              coverImageUrl: form.coverImageUrl,
              coverVideoUrl: form.coverVideoUrl || null,
              highlightDate: highlightDateIso,
              upcomingEventId: form.upcomingEventId || null,
              isPublished: form.isPublished,
              sortOrder: form.sortOrder,
            },
          },
        });
        setFeedback({ type: 'success', text: 'Highlight updated.' });
      } else {
        await createHighlight({
          variables: {
            input: {
              eventId: form.eventId,
              title: form.title,
              blurb: form.blurb || null,
              coverImageUrl: form.coverImageUrl,
              coverVideoUrl: form.coverVideoUrl || null,
              highlightDate: highlightDateIso ?? new Date().toISOString(),
              upcomingEventId: form.upcomingEventId || null,
              isPublished: form.isPublished,
              sortOrder: form.sortOrder,
            },
          },
        });
        setFeedback({ type: 'success', text: 'Highlight created.' });
      }
      await refetch();
      resetForm();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save highlight.' });
    }
  };

  const handlePublishToggle = async (id: string, published: boolean) => {
    try {
      await setHighlightPublished({ variables: { id, published } });
      await refetch();
      setFeedback({ type: 'success', text: published ? 'Highlight published.' : 'Highlight unpublished.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this highlight permanently?')) return;
    try {
      await deleteHighlight({ variables: { id } });
      await refetch();
      setFeedback({ type: 'success', text: 'Highlight deleted.' });
      if (editingId === id) resetForm();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete.' });
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading highlights...</div>;
  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load highlights: {error.message}
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none';
  const labelClass = 'block text-[0.65rem] uppercase tracking-[0.3em] text-gray-400 mb-1.5';

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Editorial Console</p>
          <h1 className="text-2xl font-semibold">Highlights</h1>
          <p className="text-sm text-gray-400">
            Curate previous-moment recaps for the landing carousel. Publish to make them live.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-black transition-all hover:bg-white/90"
        >
          Add Highlight
        </button>
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

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Highlight' : 'New Highlight'}</h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Event *</label>
              <select
                value={form.eventId}
                onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
                disabled={!!editingId}
                className={`${inputClass} disabled:opacity-50`}
                required
              >
                <option value="">Select an event…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Upcoming Event (rebook CTA)</label>
              <select
                value={form.upcomingEventId}
                onChange={(e) => setForm((f) => ({ ...f, upcomingEventId: e.target.value }))}
                className={inputClass}
              >
                <option value="">None</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="A night to remember"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Blurb</label>
              <textarea
                value={form.blurb}
                onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))}
                className={`${inputClass} min-h-[90px] resize-y`}
                placeholder="Short editorial recap…"
              />
            </div>

            <div>
              <label className={labelClass}>Cover Image URL *</label>
              <input
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://…"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Cover Video URL</label>
              <input
                type="url"
                value={form.coverVideoUrl}
                onChange={(e) => setForm((f) => ({ ...f, coverVideoUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://… (optional)"
              />
            </div>

            <div>
              <label className={labelClass}>Highlight Date</label>
              <input
                type="date"
                value={form.highlightDate}
                onChange={(e) => setForm((f) => ({ ...f, highlightDate: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="isPublished"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-black/40"
              />
              <label htmlFor="isPublished" className="text-sm text-gray-300">
                Published (visible on landing carousel)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-full bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-black transition-all hover:bg-white/90"
            >
              {editingId ? 'Save Changes' : 'Create Highlight'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/10 px-6 py-2.5 text-xs uppercase tracking-[0.25em] text-gray-400 transition-all hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {highlights.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          No highlights yet. Add one to feature a previous moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.id}
              className="card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-black/40">
                {item.coverVideoUrl ? (
                  <video
                    src={item.coverVideoUrl}
                    poster={item.coverImageUrl}
                    className="h-full w-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {item.isPublished ? (
                    <span className="rounded-full bg-green-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-black">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-black">
                      Draft
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-white/60">
                  #{item.sortOrder}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="truncate text-sm font-semibold">{item.title || 'Untitled'}</h3>
                  <p className="truncate text-xs text-gray-500">
                    {item.eventTitle || 'Unknown event'}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
                  <span>{new Date(item.highlightDate).toLocaleDateString()}</span>
                  {item.upcomingEventTitle && <span className="truncate">→ {item.upcomingEventTitle}</span>}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={() => openEdit(item)}
                    className="text-xs uppercase tracking-wide text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handlePublishToggle(item.id, !item.isPublished)}
                    className={`text-xs uppercase tracking-wide ${
                      item.isPublished
                        ? 'text-yellow-400 hover:text-yellow-300'
                        : 'text-green-400 hover:text-green-300'
                    }`}
                  >
                    {item.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs uppercase tracking-wide text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHighlightsPage;
