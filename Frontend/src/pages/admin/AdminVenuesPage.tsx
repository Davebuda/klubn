import { FormEvent, useMemo, useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  CREATE_VENUE,
  DELETE_VENUE,
  GET_VENUE_BY_ID,
  GET_VENUES,
  UPDATE_VENUE,
} from '../../graphql/queries';
import ImageUpload from '../../components/common/ImageUpload';

interface VenueFormState {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  capacity: string;
  contactEmail: string;
  phoneNumber: string;
  imageUrl: string;
  imageUrls: string[];
}

type VenueListItem = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  contactEmail?: string | null;
  phoneNumber?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

type VenueDetail = VenueListItem & {
  latitude?: number | null;
  longitude?: number | null;
};

interface VenuesQueryData {
  venues: VenueListItem[];
}

interface VenueDetailQueryData {
  venue: VenueDetail | null;
}

const emptyForm: VenueFormState = {
  name: '',
  description: '',
  address: '',
  city: '',
  country: '',
  latitude: '',
  longitude: '',
  capacity: '',
  contactEmail: '',
  phoneNumber: '',
  imageUrl: '',
  imageUrls: [],
};

const parseNullableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const AdminVenuesPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
  const textareaClass = `${inputClass} min-h-[120px]`;

  const [form, setForm] = useState<VenueFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery<VenuesQueryData>(GET_VENUES);
  const [fetchDetail, { loading: detailLoading }] = useLazyQuery<VenueDetailQueryData, { id: string }>(
    GET_VENUE_BY_ID,
  );
  const [createVenue, { loading: creating }] = useMutation(CREATE_VENUE);
  const [updateVenue, { loading: saving }] = useMutation(UPDATE_VENUE);
  const [deleteVenue, { loading: deleting }] = useMutation(DELETE_VENUE);

  const venues = useMemo(() => data?.venues ?? [], [data]);
  const isEditing = Boolean(editingId);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFeedback(null);
  };

  const handleEdit = async (id: string) => {
    const response = await fetchDetail({ variables: { id } });
    const venue = response.data?.venue;
    if (!venue) return;

    setEditingId(id);
    setFeedback(null);
    setForm({
      name: venue.name ?? '',
      description: venue.description ?? '',
      address: venue.address ?? '',
      city: venue.city ?? '',
      country: venue.country ?? '',
      latitude: venue.latitude?.toString() ?? '',
      longitude: venue.longitude?.toString() ?? '',
      capacity: venue.capacity?.toString() ?? '',
      contactEmail: venue.contactEmail ?? '',
      phoneNumber: venue.phoneNumber ?? '',
      imageUrl: venue.imageUrl ?? '',
      imageUrls: (venue as any).imageUrls ?? [],
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      latitude: parseNullableNumber(form.latitude),
      longitude: parseNullableNumber(form.longitude),
      capacity: Number(form.capacity) || 0,
      contactEmail: form.contactEmail.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      imageUrls: form.imageUrls.filter((u) => u.trim()).length > 0
        ? form.imageUrls.filter((u) => u.trim())
        : null,
    };

    try {
      if (isEditing && editingId) {
        await updateVenue({ variables: { id: editingId, input: payload } });
        setFeedback({ type: 'success', text: 'Venue updated.' });
      } else {
        await createVenue({ variables: { input: payload } });
        setFeedback({ type: 'success', text: 'Venue created.' });
      }
      await refetch();
      resetForm();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to save venue.';
      setFeedback({ type: 'error', text: message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this venue?')) return;
    try {
      await deleteVenue({ variables: { id } });
      await refetch();
      if (editingId === id) {
        resetForm();
      }
      setFeedback({ type: 'success', text: 'Venue removed.' });
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to delete venue.';
      setFeedback({ type: 'error', text: message });
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading venues…</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load venues: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Inventory</p>
        <h1 className="text-2xl font-semibold">Venues</h1>
        <p className="text-sm text-gray-400">
          Maintain venue descriptions, capacity, and coordinates so events can plug into accurate logistics.
          Select an existing venue below to edit or use the form to add a new location.
        </p>
      </header>

      <form className="card space-y-5" onSubmit={handleSubmit}>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Name
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Contact Email
            <input
              type="email"
              className={inputClass}
              value={form.contactEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
              required
            />
          </label>
        </div>

        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Description
          <textarea
            className={textareaClass}
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Address
            <input
              type="text"
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            City
            <input
              type="text"
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Country
            <input
              type="text"
              className={inputClass}
              value={form.country}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Latitude
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              value={form.latitude}
              onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Longitude
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              value={form.longitude}
              onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Capacity
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Phone Number
            <input
              type="tel"
              className={inputClass}
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
            />
          </label>
        </div>

        <ImageUpload
          currentImageUrl={form.imageUrl}
          onImageUploaded={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
          folder="venues"
          label="Venue Image (Primary)"
          aspectRatio="aspect-video"
        />

        {/* Multi-image gallery */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-300">
            Gallery Images (multiple photos for auto-scrolling carousel)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {form.imageUrls.map((url, index) => (
              <div key={index} className="relative">
                <ImageUpload
                  currentImageUrl={url}
                  onImageUploaded={(newUrl) => {
                    const updated = [...form.imageUrls];
                    updated[index] = newUrl;
                    setForm((prev) => ({ ...prev, imageUrls: updated }));
                  }}
                  folder="venues"
                  label={`Gallery ${index + 1}`}
                  aspectRatio="aspect-square"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = form.imageUrls.filter((_, i) => i !== index);
                    setForm((prev) => ({ ...prev, imageUrls: updated }));
                  }}
                  className="mt-1 w-full text-red-400 text-xs uppercase tracking-wide hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ''] }))}
            className="text-xs uppercase tracking-wide text-orange-400 hover:text-orange-300"
          >
            + Add Gallery Image
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || saving || detailLoading}
          >
            {isEditing ? 'Save Changes' : 'Create Venue'}
          </button>
          {isEditing && (
            <button type="button" className="btn-outline" onClick={resetForm}>
              Cancel
            </button>
          )}
          {detailLoading && (
            <span className="text-xs text-gray-400">Loading venue details…</span>
          )}
        </div>
      </form>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Existing Venues</h2>
            <p className="text-sm text-gray-400">Tap edit to update a venue or remove it entirely.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {venues.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-400 uppercase tracking-[0.25em] text-[0.65rem]">
                <th className="py-2">Name</th>
                <th className="py-2">City</th>
                <th className="py-2">Capacity</th>
                <th className="py-2">Contact</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No venues yet. Use the form above to add the first location.
                  </td>
                </tr>
              )}
              {venues.map((venue) => (
                <tr key={venue.id} className="border-t border-white/5">
                  <td className="py-3 font-semibold text-white">{venue.name}</td>
                  <td className="py-3 text-gray-400">
                    {[venue.city, venue.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-3 text-gray-400">
                    {venue.capacity ? venue.capacity.toLocaleString() : '—'}
                  </td>
                  <td className="py-3 text-gray-400">{venue.contactEmail ?? '—'}</td>
                  <td className="py-3 text-right space-x-2">
                    <button
                      type="button"
                      className="text-xs uppercase tracking-wide text-orange-400"
                      onClick={() => handleEdit(venue.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs uppercase tracking-wide text-red-400"
                      onClick={() => handleDelete(venue.id)}
                      disabled={deleting}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminVenuesPage;
