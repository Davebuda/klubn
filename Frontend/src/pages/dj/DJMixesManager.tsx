import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ExternalLink, Music, Pencil, Plus, Trash2 } from 'lucide-react';
import { safeHttpUrl } from '../../lib/safeHttpUrl';
import ImageUpload from '../../components/common/ImageUpload';
import { useAuth } from '../../context/AuthContext';
import {
  CREATE_DJ_MIX,
  DELETE_DJ_MIX,
  GET_DJ_MIXES,
  GET_DJS,
  UPDATE_DJ_MIX,
} from '../../graphql/queries';

type DJMix = {
  id: string;
  title: string;
  description?: string | null;
  mixUrl: string;
  thumbnailUrl?: string | null;
  genre?: string | null;
  mixType?: string | null;
  djProfileId?: string | null;
  djName?: string | null;
  createdAt: string;
};

const emptyForm = {
  title: '',
  description: '',
  mixUrl: '',
  thumbnailUrl: '',
  genre: '',
  mixType: '',
};

const detectPlatform = (url: string): string | null => {
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('mixcloud.com')) return 'mixcloud';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
};

const DJMixesManager = () => {
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: djsData } = useQuery(GET_DJS);
  const { data, loading, refetch } = useQuery(GET_DJ_MIXES);
  const [createMix] = useMutation(CREATE_DJ_MIX);
  const [updateMix] = useMutation(UPDATE_DJ_MIX);
  const [deleteMix] = useMutation(DELETE_DJ_MIX);

  useEffect(() => {
    if (!djsData?.dJs || !user?.id) return;
    const profile = djsData.dJs.find((dj: { id: string; userId?: string | null }) => dj.userId === user.id);
    if (profile) setDjId(profile.id);
  }, [djsData, user]);

  const mixes: DJMix[] = useMemo(
    () => (data?.djMixes ?? []).filter((mix: DJMix) => mix.djProfileId === djId),
    [data, djId],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleUrlChange = (url: string) => {
    const platform = detectPlatform(url);
    setForm((prev) => ({
      ...prev,
      mixUrl: url,
      mixType: platform || prev.mixType,
    }));
  };

  const handleSave = async () => {
    if (!djId || !form.title.trim() || !form.mixUrl.trim()) return;

    setSaving(true);
    try {
      const input = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        mixUrl: form.mixUrl.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        genre: form.genre.trim() || null,
        mixType: form.mixType || null,
        djProfileId: djId,
      };

      if (editingId) {
        await updateMix({ variables: { id: editingId, input } });
      } else {
        await createMix({ variables: { input } });
      }

      await refetch();
      resetForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save mix.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (mix: DJMix) => {
    setForm({
      title: mix.title,
      description: mix.description || '',
      mixUrl: mix.mixUrl,
      thumbnailUrl: mix.thumbnailUrl || '',
      genre: mix.genre || '',
      mixType: mix.mixType || '',
    });
    setEditingId(mix.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mix?')) return;
    try {
      await deleteMix({ variables: { id } });
      await refetch();
      if (editingId === id) resetForm();
    } catch (err: any) {
      alert(err.message || 'Failed to delete mix.');
    }
  };

  if (!djId && !loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
          <Music className="w-10 h-10 mx-auto text-gray-500" />
          <p className="text-lg font-semibold text-white">No DJ profile found</p>
          <p className="text-sm text-gray-400">
            Your account needs a DJ profile before you can publish mixes.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">DJ Portal</p>
          <h1 className="text-2xl font-bold text-white">My Mixes</h1>
          <p className="text-sm text-gray-400">
            Publish and maintain the mixes and live recordings attached to your profile.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black text-sm font-semibold hover:shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Mix
          </button>
        )}
      </header>

      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Mix' : 'Create Mix'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                placeholder="Mix title"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Mix URL
              <input
                value={form.mixUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                placeholder="https://soundcloud.com/..."
              />
            </label>
            <div className="md:col-span-2">
              <ImageUpload
                currentImageUrl={form.thumbnailUrl}
                onImageUploaded={(url) => setForm((prev) => ({ ...prev, thumbnailUrl: url }))}
                folder="mixes"
                label="Thumbnail"
                aspectRatio="aspect-video"
              />
            </div>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Genre
              <input
                value={form.genre}
                onChange={(e) => setForm((prev) => ({ ...prev, genre: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                placeholder="Techno, House..."
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Platform
              <select
                value={form.mixType}
                onChange={(e) => setForm((prev) => ({ ...prev, mixType: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none appearance-none"
              >
                <option value="">Auto-detect</option>
                <option value="soundcloud">SoundCloud</option>
                <option value="mixcloud">Mixcloud</option>
                <option value="youtube">YouTube</option>
              </select>
            </label>
          </div>

          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              placeholder="About this mix..."
            />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.mixUrl.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold text-sm disabled:opacity-50 hover:shadow-lg transition-all"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Mix'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mixes.length === 0 && !showForm ? (
        <div className="text-center py-16 space-y-4 rounded-2xl border border-white/10 bg-white/5">
          <Music className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-lg text-gray-400">No mixes yet. Add your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {mixes.map((mix) => (
            <div
              key={mix.id}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-black/40">
                {mix.thumbnailUrl ? (
                  <img src={mix.thumbnailUrl} alt={mix.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-orange-400/40" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate">{mix.title}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  {mix.genre && <span>{mix.genre}</span>}
                  {mix.mixType && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[0.6rem] uppercase">{mix.mixType}</span>
                  )}
                </div>
                {mix.description && <p className="text-xs text-gray-500 mt-1 truncate">{mix.description}</p>}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {safeHttpUrl(mix.mixUrl) ? (
                  <a
                    href={safeHttpUrl(mix.mixUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="p-2 rounded-lg text-gray-600 pointer-events-none opacity-50" aria-disabled="true">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleEdit(mix)}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(mix.id)}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DJMixesManager;
