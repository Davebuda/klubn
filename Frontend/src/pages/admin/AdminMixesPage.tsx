import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_DJ_MIXES, CREATE_DJ_MIX, UPDATE_DJ_MIX, DELETE_DJ_MIX, GET_DJS } from '../../graphql/queries';
import { Music, Pencil, Plus, Trash2, ExternalLink } from 'lucide-react';
import ImageUpload from '../../components/common/ImageUpload';

type DJMix = {
  id: string;
  title: string;
  description?: string;
  mixUrl: string;
  thumbnailUrl?: string;
  genre?: string;
  mixType?: string;
  djProfileId?: string;
  djName?: string;
  createdAt: string;
};

type DJ = {
  id: string;
  name: string;
  stageName: string;
};

const detectPlatform = (url: string): string | null => {
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('mixcloud.com')) return 'mixcloud';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
};

const emptyForm = {
  title: '',
  description: '',
  mixUrl: '',
  thumbnailUrl: '',
  genre: '',
  mixType: '',
  djProfileId: '',
};

const AdminMixesPage = () => {
  const { data, loading, refetch } = useQuery(GET_DJ_MIXES);
  const { data: djData } = useQuery(GET_DJS);
  const [createMix] = useMutation(CREATE_DJ_MIX);
  const [updateMix] = useMutation(UPDATE_DJ_MIX);
  const [deleteMix] = useMutation(DELETE_DJ_MIX);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const mixes: DJMix[] = data?.djMixes ?? [];
  const djs: DJ[] = djData?.dJs ?? [];

  const handleUrlChange = (url: string) => {
    const platform = detectPlatform(url);
    setForm((prev) => ({
      ...prev,
      mixUrl: url,
      mixType: platform || prev.mixType,
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.mixUrl.trim()) return;
    setSaving(true);
    try {
      const input = {
        title: form.title,
        description: form.description || null,
        mixUrl: form.mixUrl,
        thumbnailUrl: form.thumbnailUrl || null,
        genre: form.genre || null,
        mixType: form.mixType || null,
        djProfileId: form.djProfileId || null,
      };

      if (editingId) {
        await updateMix({ variables: { id: editingId, input } });
      } else {
        await createMix({ variables: { input } });
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to save mix');
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
      djProfileId: mix.djProfileId || '',
    });
    setEditingId(mix.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mix?')) return;
    await deleteMix({ variables: { id } });
    await refetch();
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mixes & Sets</h1>
          <p className="text-gray-400 text-sm mt-1">{mixes.length} mixes</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold text-sm hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add Mix
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-bold">{editingId ? 'Edit Mix' : 'New Mix'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                placeholder="Mix title"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Mix URL *</label>
              <input
                value={form.mixUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                placeholder="https://soundcloud.com/..."
              />
            </div>
            <div className="md:col-span-2">
              <ImageUpload
                currentImageUrl={form.thumbnailUrl}
                onImageUploaded={(url) => setForm(prev => ({ ...prev, thumbnailUrl: url }))}
                folder="mixes"
                label="Thumbnail"
                aspectRatio="aspect-video"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Genre</label>
              <input
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                placeholder="Techno, House..."
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Platform</label>
              <select
                value={form.mixType}
                onChange={(e) => setForm({ ...form, mixType: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none appearance-none"
              >
                <option value="">Auto-detect</option>
                <option value="soundcloud">SoundCloud</option>
                <option value="mixcloud">Mixcloud</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">DJ (optional)</label>
              <select
                value={form.djProfileId}
                onChange={(e) => setForm({ ...form, djProfileId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none appearance-none"
              >
                <option value="">No DJ</option>
                {djs.map((dj) => (
                  <option key={dj.id} value={dj.id}>
                    {dj.stageName || dj.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none"
              placeholder="About this mix..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.mixUrl.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold text-sm disabled:opacity-50 hover:shadow-lg transition-all"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mixes List */}
      {mixes.length === 0 && !showForm ? (
        <div className="text-center py-16 space-y-4">
          <Music className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-lg text-gray-400">No mixes yet. Add your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {mixes.map((mix) => (
            <div
              key={mix.id}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-black/40">
                {mix.thumbnailUrl ? (
                  <img src={mix.thumbnailUrl} alt={mix.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-orange-400/40" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate">{mix.title}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  {mix.djName && <span className="text-orange-400/80">{mix.djName}</span>}
                  {mix.genre && <span>{mix.genre}</span>}
                  {mix.mixType && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[0.6rem] uppercase">{mix.mixType}</span>
                  )}
                </div>
                {mix.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{mix.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={mix.mixUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-orange-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleEdit(mix)}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
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

export default AdminMixesPage;
