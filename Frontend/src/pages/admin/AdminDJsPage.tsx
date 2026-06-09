import { FormEvent, useMemo, useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  CREATE_DJ,
  DELETE_DJ,
  GET_DJ_BY_ID,
  GET_DJS,
  GET_GENRES,
  UPDATE_DJ,
} from '../../graphql/queries';
import ImageUpload from '../../components/common/ImageUpload';

interface SocialLinkField {
  label: string;
  url: string;
}

const SOCIAL_PLATFORMS = [
  { key: 'instagram' as const, label: 'Instagram', placeholder: 'https://www.instagram.com/yourhandle' },
  { key: 'soundCloud' as const, label: 'SoundCloud', placeholder: 'https://soundcloud.com/yourhandle' },
  { key: 'spotify' as const, label: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
  { key: 'youtube' as const, label: 'YouTube', placeholder: 'https://www.youtube.com/@yourchannel' },
  { key: 'facebook' as const, label: 'Facebook', placeholder: 'https://www.facebook.com/yourpage' },
  { key: 'twitter' as const, label: 'Twitter', placeholder: 'https://twitter.com/yourhandle' },
] as const;

type SocialPlatformKey = 'instagram' | 'soundCloud' | 'spotify' | 'youtube' | 'facebook' | 'twitter';

interface DJFormState {
  stageName: string;
  fullName: string;
  email: string;
  userId: string;
  bio: string;
  longBio: string;
  tagline: string;
  genre: string;
  profilePictureUrl: string;
  coverImageUrl: string;
  specialties: string;
  achievements: string;
  yearsExperience: string;
  influencedBy: string;
  equipmentUsed: string;
  instagram: string;
  soundCloud: string;
  spotify: string;
  youtube: string;
  facebook: string;
  twitter: string;
  topTracks: string;
}

const buildEmptyForm = (): DJFormState => ({
  stageName: '',
  fullName: '',
  email: '',
  userId: '',
  bio: '',
  longBio: '',
  tagline: '',
  genre: '',
  profilePictureUrl: '',
  coverImageUrl: '',
  specialties: '',
  achievements: '',
  yearsExperience: '',
  influencedBy: '',
  equipmentUsed: '',
  instagram: '',
  soundCloud: '',
  spotify: '',
  youtube: '',
  facebook: '',
  twitter: '',
  topTracks: '',
});

type DjListItem = {
  id: string;
  name?: string | null;
  stageName?: string | null;
  genre?: string | null;
  tagline?: string | null;
  followerCount?: number | null;
  profilePictureUrl?: string | null;
};

type DjDetail = DjListItem & {
  bio?: string | null;
  longBio?: string | null;
  profilePictureUrl?: string | null;
  coverImageUrl?: string | null;
  specialties?: string | null;
  achievements?: string | null;
  yearsExperience?: number | null;
  influencedBy?: string | null;
  equipmentUsed?: string | null;
  socialLinks?: { label: string; url: string }[];
  topTracks?: string[];
};

interface DJsQueryData {
  dJs: DjListItem[];
}

interface DJDetailQueryData {
  dj: DjDetail | null;
}

const serializeSocialLinks = (form: Pick<DJFormState, SocialPlatformKey>): string => {
  const links = SOCIAL_PLATFORMS
    .map(({ label, key }) => ({ label, url: form[key].trim() }))
    .filter((l) => l.url);
  return JSON.stringify(links);
};

const extractSocialUrl = (links: SocialLinkField[] | undefined, label: string): string =>
  links?.find((l) => l.label?.toLowerCase() === label.toLowerCase())?.url ?? '';

const AdminDJsPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
  const textareaClass = `${inputClass} min-h-[120px]`;
  const [form, setForm] = useState<DJFormState>(buildEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery<DJsQueryData>(GET_DJS);
  const { data: genresData } = useQuery(GET_GENRES);
  const genreOptions: { id: string; name: string }[] = genresData?.genres ?? [];
  const [fetchDetail, { loading: detailLoading }] = useLazyQuery<DJDetailQueryData, { id: string }>(
    GET_DJ_BY_ID,
  );
  const [createDj, { loading: creating }] = useMutation(CREATE_DJ);
  const [updateDj, { loading: saving }] = useMutation(UPDATE_DJ);
  const [deleteDj, { loading: deleting }] = useMutation(DELETE_DJ);

  const djs = useMemo(() => data?.dJs ?? [], [data]);
  const isEditing = Boolean(editingId);

  const clearForm = () => {
    setForm(buildEmptyForm());
    setEditingId(null);
  };

  const resetForm = () => {
    clearForm();
    setFeedback(null);
  };

  const handleEdit = async (id: string) => {
    try {
      const response = await fetchDetail({ variables: { id } });
      const detail = response.data?.dj;
      if (!detail) {
        throw new Error('DJ details not found.');
      }

      setEditingId(id);
      setFeedback(null);
      setForm({
        stageName: detail.stageName ?? '',
        fullName: detail.name ?? '',
        email: '',
        userId: '',
        bio: detail.bio ?? '',
        longBio: detail.longBio ?? '',
        tagline: detail.tagline ?? '',
        genre: detail.genre ?? '',
        profilePictureUrl: detail.profilePictureUrl ?? '',
        coverImageUrl: detail.coverImageUrl ?? '',
        specialties: detail.specialties ?? '',
        achievements: detail.achievements ?? '',
        yearsExperience: detail.yearsExperience?.toString() ?? '',
        influencedBy: detail.influencedBy ?? '',
        equipmentUsed: detail.equipmentUsed ?? '',
        instagram: extractSocialUrl(detail.socialLinks, 'Instagram'),
        soundCloud: extractSocialUrl(detail.socialLinks, 'SoundCloud'),
        spotify: extractSocialUrl(detail.socialLinks, 'Spotify'),
        youtube: extractSocialUrl(detail.socialLinks, 'YouTube'),
        facebook: extractSocialUrl(detail.socialLinks, 'Facebook'),
        twitter: extractSocialUrl(detail.socialLinks, 'Twitter'),
        topTracks: (detail.topTracks ?? []).join('\n'),
      });
    } catch (editError) {
      const message =
        editError instanceof Error ? editError.message : 'Failed to load DJ details.';
      setFeedback({ type: 'error', text: message });
      setEditingId(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    // Validate required fields
    const missing: string[] = [];
    if (!form.stageName.trim()) missing.push('Stage Name');
    if (!form.fullName.trim()) missing.push('Full Name');
    if (!isEditing && !form.email.trim()) missing.push('Email');
    if (!form.bio.trim()) missing.push('Short Bio');
    if (!form.genre.trim()) missing.push('Genre');
    if (!form.profilePictureUrl.trim()) missing.push('Profile Picture');

    if (missing.length > 0) {
      setFeedback({ type: 'error', text: `Required fields missing: ${missing.join(', ')}` });
      return;
    }

    const payloadBase = {
      stageName: form.stageName.trim(),
      fullName: form.fullName.trim(),
      bio: form.bio.trim(),
      longBio: form.longBio.trim() || null,
      tagline: form.tagline.trim() || null,
      genre: form.genre.trim(),
      socialLinks: serializeSocialLinks(form),
      profilePictureUrl: form.profilePictureUrl.trim(),
      coverImageUrl: form.coverImageUrl.trim() || null,
      specialties: form.specialties.trim() || null,
      achievements: form.achievements.trim() || null,
      yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
      influencedBy: form.influencedBy.trim() || null,
      equipmentUsed: form.equipmentUsed.trim() || null,
      topTracks: form.topTracks
        .split('\n')
        .map((track) => track.trim())
        .filter(Boolean),
    };

    try {
      if (isEditing && editingId) {
        await updateDj({
          variables: {
            id: editingId,
            input: payloadBase,
          },
        });
        setFeedback({ type: 'success', text: 'DJ profile updated.' });
      } else {
        await createDj({
          variables: {
            input: {
              ...payloadBase,
              email: form.email.trim() || null,
              userId: form.userId.trim(),
            },
          },
        });
        setFeedback({ type: 'success', text: 'DJ profile created.' });
      }

      await refetch();
      clearForm();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : 'Failed to save DJ profile.';
      setFeedback({
        type: 'error',
        text: message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this DJ profile?')) return;
    try {
      await deleteDj({ variables: { id } });
      await refetch();
      if (editingId === id) {
        resetForm();
      }
      setFeedback({ type: 'success', text: 'DJ removed.' });
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to delete DJ.';
      setFeedback({
        type: 'error',
        text: message,
      });
    }
  };


  if (loading) {
    return <div className="text-sm text-gray-400">Loading DJ profiles…</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load DJs: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">DJs</h1>
        <p className="text-sm text-gray-400">
          Administer every DJ profile in the catalog. Fill the form to create a new artist or select
          an existing DJ below to update their bio, media, top tracks, and social links.
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
            Stage Name
            <input
              type="text"
              className={inputClass}
              value={form.stageName}
              onChange={(e) => setForm((prev) => ({ ...prev, stageName: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Full Name *
            <input
              type="text"
              className={inputClass}
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Email {isEditing ? '' : '*'}
            <input
              type="email"
              className={`${inputClass} disabled:opacity-60`}
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              disabled={isEditing}
              required={!isEditing}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            User Id
            <input
              type="text"
              className={`${inputClass} disabled:opacity-60`}
              value={form.userId}
              onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
              disabled={isEditing}
              placeholder="Leave blank to auto-assign your admin account"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Short Bio
          <textarea
            className={textareaClass}
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            required
          />
        </label>

        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Long Bio / Press Kit
          <textarea
            className={`${textareaClass} min-h-[180px]`}
            value={form.longBio}
            onChange={(e) => setForm((prev) => ({ ...prev, longBio: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Tagline
            <input
              type="text"
              className={inputClass}
              value={form.tagline}
              onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
            />
          </label>
          <div className="space-y-1 text-sm font-semibold text-gray-300">
            Genre *
            <div className="flex flex-wrap gap-2 mt-1">
              {genreOptions.map((g) => {
                const selected = form.genre
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .includes(g.name);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setForm((prev) => {
                        const current = prev.genre
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const next = selected
                          ? current.filter((n) => n !== g.name)
                          : [...current, g.name];
                        return { ...prev, genre: next.join(', ') };
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      selected
                        ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black border-orange-500'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:border-orange-400/50 hover:text-white'
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Years Experience
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.yearsExperience}
              onChange={(e) => setForm((prev) => ({ ...prev, yearsExperience: e.target.value }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageUpload
            currentImageUrl={form.profilePictureUrl}
            onImageUploaded={(url) => setForm((prev) => ({ ...prev, profilePictureUrl: url }))}
            folder="djs/profile"
            label="Profile Picture *"
            aspectRatio="aspect-square"
          />
          <ImageUpload
            currentImageUrl={form.coverImageUrl}
            onImageUploaded={(url) => setForm((prev) => ({ ...prev, coverImageUrl: url }))}
            folder="djs/covers"
            label="Cover Image"
            aspectRatio="aspect-video"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Specialties
            <textarea
              className={textareaClass}
              value={form.specialties}
              onChange={(e) => setForm((prev) => ({ ...prev, specialties: e.target.value }))}
              placeholder="Mixing styles, live instruments, etc."
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Achievements
            <textarea
              className={textareaClass}
              value={form.achievements}
              onChange={(e) => setForm((prev) => ({ ...prev, achievements: e.target.value }))}
              placeholder="Awards, festival highlights…"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Influenced By
            <textarea
              className={textareaClass}
              value={form.influencedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, influencedBy: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Equipment Used
            <textarea
              className={textareaClass}
              value={form.equipmentUsed}
              onChange={(e) => setForm((prev) => ({ ...prev, equipmentUsed: e.target.value }))}
            />
          </label>
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-200 tracking-wide uppercase">Social Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <label key={key} className="space-y-1 text-sm font-semibold text-gray-300">
                {label}
                <input
                  type="url"
                  className={inputClass}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </section>

        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Top Tracks (one per line)
          <textarea
            className={`${textareaClass} min-h-[160px]`}
            value={form.topTracks}
            onChange={(e) => setForm((prev) => ({ ...prev, topTracks: e.target.value }))}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || saving || detailLoading}
          >
            {isEditing ? 'Save Changes' : 'Create DJ'}
          </button>
          {isEditing && (
            <button type="button" className="btn-outline" onClick={resetForm}>
              Cancel
            </button>
          )}
          {detailLoading && (
            <span className="text-xs text-gray-400">Loading DJ details…</span>
          )}
        </div>
      </form>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Existing DJs</h3>
            <p className="text-sm text-gray-400">Select a DJ to edit or remove.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {djs.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-400 uppercase tracking-[0.25em] text-[0.65rem]">
                <th className="py-2 text-left">DJ</th>
                <th className="py-2 text-left">Genres</th>
                <th className="py-2 text-left">Tagline</th>
                <th className="py-2 text-left">Followers</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {djs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No DJ profiles yet. Use the form above to add the first one.
                  </td>
                </tr>
              )}
              {djs.map((dj) => {
                const followerDisplay =
                  typeof dj.followerCount === 'number'
                    ? dj.followerCount.toLocaleString()
                    : '0';

                return (
                  <tr key={dj.id} className="border-t border-white/5">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full border border-white/10 overflow-hidden bg-black/40">
                        {dj.profilePictureUrl ? (
                          <img
                            src={dj.profilePictureUrl ?? ''}
                            alt={dj.stageName || dj.name || 'DJ avatar'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs uppercase tracking-[0.4em] text-gray-500">
                            {dj.stageName?.charAt(0) ?? dj.name?.charAt(0) ?? '?'}
                          </div>
                        )}
                        </div>
                        <div className="text-sm">
                          <p className="font-semibold text-white">{dj.stageName || dj.name}</p>
                          <p className="text-gray-500 text-xs uppercase tracking-[0.4em]">{dj.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-400">
                      <div className="flex flex-wrap gap-2">
                        {(dj.genre ?? '')
                          .split(',')
                          .map((genre: string) => genre.trim())
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((genre) => (
                            <span key={`${dj.id}-${genre}`} className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.35em]">
                              {genre}
                            </span>
                          ))}
                        {!dj.genre && <span className="text-gray-600 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="py-3 text-gray-400">{dj.tagline ?? '—'}</td>
                    <td className="py-3 text-gray-400">{followerDisplay}</td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-orange-400"
                        onClick={() => handleEdit(dj.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-red-400"
                        onClick={() => handleDelete(dj.id)}
                        disabled={deleting}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDJsPage;
