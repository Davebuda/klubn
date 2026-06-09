import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_GENRES,
  CREATE_GENRE,
  UPDATE_GENRE,
} from '../../graphql/queries';

interface Genre {
  id: string;
  name: string;
}

const AdminGenresPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';

  const { data, loading, error, refetch } = useQuery(GET_GENRES);
  const [createGenre, { loading: creating }] = useMutation(CREATE_GENRE);
  const [updateGenre, { loading: saving }] = useMutation(UPDATE_GENRE);

  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const genres: Genre[] = useMemo(() => data?.genres ?? [], [data]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      if (editingId) {
        await updateGenre({ variables: { id: editingId, input: { name: trimmed } } });
        setFeedback({ type: 'success', text: 'Genre updated.' });
      } else {
        await createGenre({ variables: { input: { name: trimmed } } });
        setFeedback({ type: 'success', text: 'Genre created.' });
      }
      await refetch();
      setName('');
      setEditingId(null);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save genre.' });
    }
  };

  const handleEdit = (genre: Genre) => {
    setEditingId(genre.id);
    setName(genre.name);
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setFeedback(null);
  };

  if (loading) return <div className="text-sm text-gray-400">Loading genres...</div>;
  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load genres: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Catalog</p>
        <h1 className="text-2xl font-semibold">Genres</h1>
        <p className="text-sm text-gray-400">
          Manage the genre tags used across events and DJ profiles.
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

      {/* Add / Edit form */}
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm font-semibold text-gray-300">
          {editingId ? 'Edit Genre' : 'New Genre'}
          <input
            type="text"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Afro House"
            required
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn-primary whitespace-nowrap"
            disabled={creating || saving}
          >
            {editingId ? 'Save' : 'Add Genre'}
          </button>
          {editingId && (
            <button type="button" className="btn-outline" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Genre list */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">All Genres</h3>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {genres.length} total
          </span>
        </div>

        {genres.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No genres yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {genres.map((genre) => (
              <div
                key={genre.id}
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition-all ${
                  editingId === genre.id
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                <span className="text-sm font-medium">{genre.name}</span>
                <button
                  onClick={() => handleEdit(genre)}
                  className="text-[0.65rem] uppercase tracking-wide text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGenresPage;
