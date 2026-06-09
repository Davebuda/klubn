import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import {
  CREATE_EVENT_AS_ORGANIZER,
  UPDATE_EVENT_AS_ORGANIZER,
  GET_MY_ORGANIZER_EVENTS,
  GET_VENUES,
  GET_GENRES,
  GET_DJS,
  GET_EVENT_BY_ID,
} from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/common/ImageUpload';

interface FormState {
  title: string;
  description: string;
  date: string;
  price: string;
  venueId: string;
  imageUrl: string;
  videoUrl: string;
  ticketingUrl: string;
  genreIds: string[];
  djIds: string[];
}

const empty: FormState = {
  title: '',
  description: '',
  date: '',
  price: '0',
  venueId: '',
  imageUrl: '',
  videoUrl: '',
  ticketingUrl: '',
  genreIds: [],
  djIds: [],
};

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500';

const OrganizerEventForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: venuesData } = useQuery(GET_VENUES);
  const { data: genresData } = useQuery(GET_GENRES);
  const { data: djsData } = useQuery(GET_DJS);
  const [fetchEvent] = useLazyQuery(GET_EVENT_BY_ID);

  const refetchEvents = [{ query: GET_MY_ORGANIZER_EVENTS, variables: { userId: user?.id } }];
  const [createEvent, { loading: creating }] = useMutation(CREATE_EVENT_AS_ORGANIZER, { refetchQueries: refetchEvents });
  const [updateEvent, { loading: saving }] = useMutation(UPDATE_EVENT_AS_ORGANIZER, { refetchQueries: refetchEvents });

  const venues = venuesData?.venues ?? [];
  const genres = genresData?.genres ?? [];
  const djs = djsData?.dJs ?? [];

  useEffect(() => {
    if (isEditing && id) {
      fetchEvent({ variables: { id } }).then(({ data }) => {
        const ev = data?.event;
        if (!ev) return;
        setForm({
          title: ev.title ?? '',
          description: ev.description ?? '',
          date: ev.date ? ev.date.slice(0, 16) : '',
          price: ev.price?.toString() ?? '0',
          venueId: ev.venueId ?? '',
          imageUrl: ev.imageUrl ?? '',
          videoUrl: ev.videoUrl ?? '',
          ticketingUrl: ev.ticketingUrl ?? '',
          genreIds: ev.genreIds ?? [],
          djIds: ev.djIds ?? [],
        });
      });
    }
  }, [id, isEditing, fetchEvent]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const payload = {
      title: form.title,
      description: form.description,
      date: new Date(form.date).toISOString(),
      price: parseFloat(form.price) || 0,
      venueId: form.venueId,
      imageUrl: form.imageUrl || null,
      videoUrl: form.videoUrl || null,
      ticketingUrl: form.ticketingUrl || null,
      genreIds: form.genreIds,
      djIds: form.djIds,
    };
    try {
      if (isEditing) {
        await updateEvent({ variables: { id, input: payload } });
        setFeedback({ type: 'success', text: 'Event updated and re-submitted for approval.' });
      } else {
        await createEvent({ variables: { input: payload } });
        setFeedback({ type: 'success', text: 'Event submitted for admin review!' });
        setTimeout(() => navigate('/organizer-dashboard/events'), 1500);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save event.' });
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-400">Organizer Portal</p>
          <h1 className="text-2xl font-bold text-white">{isEditing ? 'Edit Event' : 'Create New Event'}</h1>
          <p className="text-sm text-gray-400">
            {isEditing
              ? 'Update your event details. It will be re-submitted for admin approval.'
              : 'Fill in your event details. An admin will review and publish it within 24–48 hours.'}
          </p>
        </header>

        {/* Approval notice */}
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-xs text-orange-300">
          Events are reviewed by an admin before going live on the platform.
        </div>

        {feedback && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Event Title *
              <input className={inputClass} required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Summer Underground" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Date & Time *
              <input className={inputClass} type="datetime-local" required value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Ticket Price (kr)
              <input className={inputClass} type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Venue *
              <select className={inputClass} required value={form.venueId} onChange={(e) => setForm((p) => ({ ...p, venueId: e.target.value }))}>
                <option value="">Select a venue</option>
                {venues.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} – {v.city}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-gray-300">
            Description
            <textarea className={`${inputClass} min-h-[120px]`} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the vibe, lineup highlights, etc." />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Genres (hold Ctrl/Cmd to select multiple)
              <select className={`${inputClass} h-28`} multiple value={form.genreIds} onChange={(e) => setForm((p) => ({ ...p, genreIds: Array.from(e.target.selectedOptions, (o) => o.value) }))}>
                {genres.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              DJs (hold Ctrl/Cmd to select multiple)
              <select className={`${inputClass} h-28`} multiple value={form.djIds} onChange={(e) => setForm((p) => ({ ...p, djIds: Array.from(e.target.selectedOptions, (o) => o.value) }))}>
                {djs.map((d: any) => <option key={d.id} value={d.id}>{d.stageName || d.name}</option>)}
              </select>
            </label>
          </div>

          <ImageUpload
            currentImageUrl={form.imageUrl}
            onImageUploaded={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
            folder="events"
            label="Event Flyer / Image"
            aspectRatio="aspect-[3/4]"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              Promo Video URL (optional)
              <input className={inputClass} type="url" value={form.videoUrl} onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-gray-300">
              External Ticket Link (optional)
              <input className={inputClass} type="url" value={form.ticketingUrl} onChange={(e) => setForm((p) => ({ ...p, ticketingUrl: e.target.value }))} placeholder="https://ticketmaster.com/..." />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={creating || saving}
              className="rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] px-8 py-3 text-sm font-bold uppercase tracking-widest text-black hover:opacity-90 transition disabled:opacity-50"
            >
              {creating || saving ? 'Saving…' : isEditing ? 'Update & Re-submit' : 'Submit for Review'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/organizer-dashboard/events')}
              className="rounded-full border border-white/20 px-6 py-3 text-sm text-gray-300 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrganizerEventForm;
