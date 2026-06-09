import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import ImageUpload from '../../components/common/ImageUpload';
import {
  CREATE_DJ_TOP10_ENTRY,
  CREATE_PLAYLIST,
  CREATE_SONG,
  DELETE_DJ_TOP10_ENTRY,
  DELETE_PLAYLIST,
  ADD_PLAYLIST_SONG,
  REMOVE_PLAYLIST_SONG,
  GET_DJ_TOP10_LISTS,
  GET_DJS,
  GET_PLAYLISTS,
  GET_SONGS,
  FETCH_SONG_METADATA,
} from '../../graphql/queries';

/* ── Types ── */

type PlaylistSong = {
  id: string;
  songId: string;
  position: number;
  title: string;
  artist: string;
  genre?: string | null;
  spotifyUrl?: string | null;
  soundCloudUrl?: string | null;
};

type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  genre?: string | null;
  coverImageUrl?: string | null;
  curator?: string | null;
  songs: PlaylistSong[];
};

type PlaylistEntry = {
  id: string;
  djId: string;
  songId: string;
  songTitle: string;
};

type PlaylistGroup = {
  djId: string;
  djStageName: string;
  top10Songs: PlaylistEntry[];
};

type SongOption = {
  id: string;
  title: string;
  artist: string;
  duration?: number | null;
};

/* ── Helpers ── */

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const inputClass =
  'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
const selectClass = `${inputClass} appearance-none`;

/* ════════════════════════════════════════ */

const AdminPlaylistsPage = () => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'djtop10'>('playlists');

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Curation</p>
        <h1 className="text-2xl font-semibold">Playlist Management</h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
        {(['playlists', 'djtop10'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-orange-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'playlists' ? 'Playlists' : 'DJ Top 10'}
          </button>
        ))}
      </div>

      {activeTab === 'playlists' ? <PlaylistsTab /> : <DJTop10Tab />}
    </div>
  );
};

/* ════════════════════ PLAYLISTS TAB ════════════════════ */

const PlaylistsTab = () => {
  const { data, loading, error, refetch } = useQuery(GET_PLAYLISTS);
  const { data: songsData, refetch: refetchSongs } = useQuery(GET_SONGS);
  const [createPlaylist, { loading: creating }] = useMutation(CREATE_PLAYLIST);
  const [deletePlaylist] = useMutation(DELETE_PLAYLIST);
  const [addSong] = useMutation(ADD_PLAYLIST_SONG);
  const [removeSong] = useMutation(REMOVE_PLAYLIST_SONG);
  const [createSong, { loading: creatingSong }] = useMutation(CREATE_SONG);

  const playlists: Playlist[] = useMemo(() => data?.playlists ?? [], [data]);
  const songs: SongOption[] = useMemo(() => songsData?.songs ?? [], [songsData]);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ title: '', description: '', genre: '', coverImageUrl: '', curator: '', playlistUrl: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addSongId, setAddSongId] = useState('');
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);

  // New song inline form
  const [showNewSong, setShowNewSong] = useState(false);
  const [songForm, setSongForm] = useState({
    title: '', artist: '', genre: '', duration: '', coverImageUrl: '', spotifyUrl: '', soundCloudUrl: '',
  });
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchMetadata] = useLazyQuery(FETCH_SONG_METADATA);

  const handleFetchPlaylistMetadata = async () => {
    if (!form.playlistUrl.trim()) return;
    setFetchingPlaylist(true);
    try {
      const { data: metaData } = await fetchMetadata({ variables: { url: form.playlistUrl.trim() } });
      if (metaData?.fetchSongMetadata) {
        const m = metaData.fetchSongMetadata;
        setForm((p) => ({
          ...p,
          title: p.title || m.title || '',
          coverImageUrl: p.coverImageUrl || m.coverImageUrl || '',
          curator: p.curator || m.artist || '',
        }));
        setFeedback({ type: 'success', text: 'Playlist details fetched from URL.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Could not fetch playlist data.' });
    } finally {
      setFetchingPlaylist(false);
    }
  };

  const handleCreatePlaylist = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.playlistUrl.trim() && !form.title.trim()) {
      setFeedback({ type: 'error', text: 'Enter a Spotify / SoundCloud URL or a title.' });
      return;
    }
    try {
      await createPlaylist({
        variables: {
          input: {
            title: form.title.trim() || 'Untitled Playlist',
            description: form.description.trim() || null,
            genre: form.genre.trim() || null,
            coverImageUrl: form.coverImageUrl || null,
            curator: form.curator.trim() || null,
            playlistUrl: form.playlistUrl.trim() || null,
          },
        },
      });
      await refetch();
      setForm({ title: '', description: '', genre: '', coverImageUrl: '', curator: '', playlistUrl: '' });
      setFeedback({ type: 'success', text: 'Playlist created.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create playlist.' });
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist and all its songs?')) return;
    try {
      await deletePlaylist({ variables: { id } });
      await refetch();
      setFeedback({ type: 'success', text: 'Playlist deleted.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete.' });
    }
  };

  const handleAddSong = async (playlistId: string) => {
    if (!addSongId) return;
    const playlist = playlists.find((p) => p.id === playlistId);
    const position = (playlist?.songs.length ?? 0) + 1;
    try {
      await addSong({ variables: { input: { playlistId, songId: addSongId, position } } });
      await refetch();
      setAddSongId('');
      setFeedback({ type: 'success', text: 'Song added to playlist.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add song.' });
    }
  };

  const handleRemoveSong = async (playlistSongId: string) => {
    try {
      await removeSong({ variables: { id: playlistSongId } });
      await refetch();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove.' });
    }
  };

  const handleFetchMetadata = async () => {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    try {
      const { data: metaData } = await fetchMetadata({ variables: { url: fetchUrl.trim() } });
      if (metaData?.fetchSongMetadata) {
        const m = metaData.fetchSongMetadata;
        setSongForm((p) => ({
          ...p,
          title: m.title || '',
          artist: m.artist || '',
          coverImageUrl: m.coverImageUrl || '',
          spotifyUrl: m.spotifyUrl || p.spotifyUrl,
          soundCloudUrl: m.soundCloudUrl || p.soundCloudUrl,
        }));
        setFeedback({ type: 'success', text: 'Song details fetched from URL.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Could not fetch metadata.' });
    } finally {
      setFetching(false);
    }
  };

  const handleCreateSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songForm.title.trim() || !songForm.artist.trim()) {
      setFeedback({ type: 'error', text: 'Song title and artist are required.' });
      return;
    }
    try {
      const durationSeconds = parseInt(songForm.duration, 10);
      const res = await createSong({
        variables: {
          input: {
            title: songForm.title.trim(),
            artist: songForm.artist.trim(),
            genre: songForm.genre.trim() || null,
            duration: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
            coverImageUrl: songForm.coverImageUrl.trim() || null,
            spotifyUrl: songForm.spotifyUrl.trim() || null,
            soundCloudUrl: songForm.soundCloudUrl.trim() || null,
          },
        },
      });
      await refetchSongs();
      const newId = res.data?.createSong;
      if (newId) setAddSongId(newId);
      setSongForm({ title: '', artist: '', genre: '', duration: '', coverImageUrl: '', spotifyUrl: '', soundCloudUrl: '' });
      setFetchUrl('');
      setShowNewSong(false);
      setFeedback({ type: 'success', text: 'Song created. Now add it to the playlist.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create song.' });
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading playlists...</div>;
  if (error) return <div className="text-red-300">Failed to load: {error.message}</div>;

  return (
    <div className="space-y-8">
      {feedback && (
        <div className={`rounded px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'}`}>
          {feedback.text}
        </div>
      )}

      {/* Create Playlist */}
      <form className="card space-y-4" onSubmit={handleCreatePlaylist}>
        <h2 className="text-lg font-semibold">Create Playlist</h2>

        {/* URL first — paste to auto-fill everything */}
        <div className="space-y-1 text-sm font-semibold text-gray-300">
          Spotify / SoundCloud Playlist URL
          <div className="flex gap-2 mt-1">
            <input type="url" className={`${inputClass} flex-1`} value={form.playlistUrl}
              onChange={(e) => setForm((p) => ({ ...p, playlistUrl: e.target.value }))}
              placeholder="https://open.spotify.com/playlist/..." />
            <button type="button" className="btn-outline whitespace-nowrap"
              disabled={!form.playlistUrl.trim() || fetchingPlaylist}
              onClick={handleFetchPlaylistMetadata}>
              {fetchingPlaylist ? 'Fetching…' : 'Fetch Details'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Title <span className="text-gray-500 font-normal">(auto-filled from URL)</span>
            <input type="text" className={inputClass} value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Auto-filled or enter manually" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Genre
            <input type="text" className={inputClass} value={form.genre}
              onChange={(e) => setForm((p) => ({ ...p, genre: e.target.value }))} placeholder="e.g. House / Tech" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Curator <span className="text-gray-500 font-normal">(auto-filled from URL)</span>
            <input type="text" className={inputClass} value={form.curator}
              onChange={(e) => setForm((p) => ({ ...p, curator: e.target.value }))} placeholder="Auto-filled or enter manually" />
          </label>
        </div>
        <label className="space-y-1 text-sm font-semibold text-gray-300">
          Description
          <textarea className={inputClass} rows={2} value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </label>
        <ImageUpload
          currentImageUrl={form.coverImageUrl}
          onImageUploaded={(url) => setForm((p) => ({ ...p, coverImageUrl: url }))}
          folder="playlists"
          label="Cover Image (auto-fetched from URL)"
          aspectRatio="aspect-square"
        />
        <button type="submit" className="btn-primary" disabled={creating}>Create Playlist</button>
      </form>

      {/* Existing Playlists */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Existing Playlists</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">{playlists.length} playlists</span>
        </div>

        {playlists.length === 0 && (
          <p className="py-6 text-center text-gray-500">No playlists yet. Create one above.</p>
        )}

        {playlists.map((playlist) => (
          <div key={playlist.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{playlist.title}</h3>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  {playlist.genre && <span className="uppercase tracking-wider">{playlist.genre}</span>}
                  {playlist.curator && <span>by {playlist.curator}</span>}
                  <span>{playlist.songs.length} tracks</span>
                </div>
                {playlist.description && <p className="text-sm text-gray-400 mt-2">{playlist.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="text-xs uppercase tracking-wider text-gray-400 hover:text-white"
                  onClick={() => setExpandedId(expandedId === playlist.id ? null : playlist.id)}>
                  {expandedId === playlist.id ? 'Collapse' : 'Manage'}
                </button>
                <button type="button" className="text-xs uppercase tracking-wider text-red-400 hover:text-red-300"
                  onClick={() => handleDeletePlaylist(playlist.id)}>
                  Delete
                </button>
              </div>
            </div>

            {expandedId === playlist.id && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                {/* Song list */}
                <ul className="space-y-2">
                  {playlist.songs.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/30 px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{s.title}</p>
                          <p className="text-xs text-gray-400">{s.artist}</p>
                        </div>
                        <div className="flex gap-1.5 ml-2">
                          {s.spotifyUrl && (
                            <a href={s.spotifyUrl} target="_blank" rel="noreferrer" title="Spotify"
                              className="text-[#1DB954] hover:opacity-80">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                            </a>
                          )}
                          {s.soundCloudUrl && (
                            <a href={s.soundCloudUrl} target="_blank" rel="noreferrer" title="SoundCloud"
                              className="text-[#FF5500] hover:opacity-80">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.035.104-.094l.2-1.308-.2-1.332c-.015-.057-.047-.094-.104-.094m1.8-1.143c-.066 0-.118.053-.118.12l-.213 2.449.213 2.379c0 .066.052.119.118.119.065 0 .118-.053.118-.119l.241-2.379-.24-2.449c0-.067-.054-.12-.12-.12m.899-.166c-.08 0-.14.063-.14.14l-.197 2.615.197 2.56c0 .077.06.14.14.14.078 0 .139-.063.139-.14l.222-2.56-.222-2.614c0-.078-.06-.141-.14-.141m.899-.254c-.09 0-.159.073-.159.16l-.18 2.869.18 2.637c0 .088.07.16.159.16.089 0 .16-.072.16-.16l.204-2.637-.204-2.87c0-.087-.071-.159-.16-.159m.9-.36c-.1 0-.179.08-.179.18l-.163 3.23.163 2.7c0 .1.08.18.18.18.098 0 .178-.08.178-.18l.186-2.7-.186-3.23c0-.1-.08-.18-.18-.18m.899-.182c-.11 0-.198.09-.198.2l-.145 3.412.145 2.742c0 .11.088.2.198.2.11 0 .2-.09.2-.2l.166-2.742-.166-3.412c0-.11-.09-.2-.2-.2m1.098-.28c-.12 0-.218.098-.218.22l-.127 3.692.127 2.768c0 .122.097.22.218.22.12 0 .219-.098.219-.22l.145-2.768-.145-3.693c0-.122-.098-.22-.22-.22m.899.11c-.133 0-.237.107-.237.24l-.109 3.342.109 2.779c0 .133.104.24.237.24.132 0 .237-.107.237-.24l.125-2.779-.125-3.342c0-.133-.105-.24-.237-.24m1.099-.36c-.143 0-.257.117-.257.26l-.092 3.702.092 2.788c0 .144.114.261.257.261.144 0 .258-.117.258-.26l.104-2.789-.104-3.702c0-.143-.114-.26-.258-.26m1.174-.546c-.065-.007-.133-.01-.2-.01-.144 0-.283.018-.42.05-.152 0-.271.12-.271.28l-.074 4.009.074 2.772c0 .157.12.28.27.28.15 0 .272-.123.272-.28l.084-2.772-.084-4.01c0-.157-.12-.279-.272-.279m1.07.527c-.154 0-.278.126-.278.28l-.056 3.481.056 2.759c0 .156.124.28.278.28s.28-.124.28-.28l.063-2.759-.063-3.48c0-.155-.126-.281-.28-.281m.899.16c-.164 0-.298.136-.298.3l-.038 3.321.038 2.737c0 .166.134.3.298.3.165 0 .3-.134.3-.3l.044-2.737-.044-3.322c0-.164-.135-.3-.3-.3m4.137-.467c-.27-.087-.556-.135-.854-.135-1.483 0-2.693 1.19-2.726 2.664l-.023 1.258.023 2.699c.005.167.142.3.31.3h3.27c1.318 0 2.386-1.067 2.386-2.386V12.9c0-1.318-1.068-2.386-2.386-2.386"/></svg>
                            </a>
                          )}
                        </div>
                      </div>
                      <button type="button" className="text-xs uppercase tracking-wider text-red-400 hover:text-red-300"
                        onClick={() => handleRemoveSong(s.id)}>
                        Remove
                      </button>
                    </li>
                  ))}
                  {playlist.songs.length === 0 && (
                    <li className="text-center text-gray-500 py-3 text-sm">No tracks yet. Add songs below.</li>
                  )}
                </ul>

                {/* Add song to playlist */}
                <div className="flex gap-2 items-end">
                  <label className="flex-1 space-y-1 text-sm font-semibold text-gray-300">
                    Add Song
                    <select className={selectClass} value={addSongId} onChange={(e) => setAddSongId(e.target.value)}>
                      <option value="">Select a song...</option>
                      {songs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} — {s.artist}{s.duration ? ` (${formatDuration(s.duration)})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn-primary whitespace-nowrap" disabled={!addSongId}
                    onClick={() => handleAddSong(playlist.id)}>
                    Add
                  </button>
                  <button type="button" className="btn-outline whitespace-nowrap"
                    onClick={() => setShowNewSong(!showNewSong)}>
                    {showNewSong ? 'Cancel' : 'New Song'}
                  </button>
                </div>

                {/* Inline new song form */}
                {showNewSong && (
                  <form className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3" onSubmit={handleCreateSong}>
                    <p className="text-sm font-semibold text-gray-300">Create New Song</p>
                    {/* URL auto-fetch */}
                    <div className="flex gap-2">
                      <input type="url" className={`${inputClass} flex-1`} placeholder="Paste Spotify or SoundCloud URL..."
                        value={fetchUrl} onChange={(e) => setFetchUrl(e.target.value)} />
                      <button type="button" className="btn-outline whitespace-nowrap" disabled={!fetchUrl.trim() || fetching}
                        onClick={handleFetchMetadata}>
                        {fetching ? 'Fetching...' : 'Fetch Details'}
                      </button>
                    </div>
                    {songForm.coverImageUrl && (
                      <div className="flex items-center gap-3">
                        <img src={songForm.coverImageUrl} alt="Cover" className="w-10 h-10 rounded object-cover" />
                        <span className="text-xs text-gray-400">Cover image fetched</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" className={inputClass} placeholder="Title *" value={songForm.title}
                        onChange={(e) => setSongForm((p) => ({ ...p, title: e.target.value }))} required />
                      <input type="text" className={inputClass} placeholder="Artist *" value={songForm.artist}
                        onChange={(e) => setSongForm((p) => ({ ...p, artist: e.target.value }))} required />
                      <input type="text" className={inputClass} placeholder="Genre" value={songForm.genre}
                        onChange={(e) => setSongForm((p) => ({ ...p, genre: e.target.value }))} />
                      <input type="number" className={inputClass} placeholder="Duration (seconds)" value={songForm.duration}
                        onChange={(e) => setSongForm((p) => ({ ...p, duration: e.target.value }))} />
                      <input type="url" className={inputClass} placeholder="Spotify URL" value={songForm.spotifyUrl}
                        onChange={(e) => setSongForm((p) => ({ ...p, spotifyUrl: e.target.value }))} />
                      <input type="url" className={inputClass} placeholder="SoundCloud URL" value={songForm.soundCloudUrl}
                        onChange={(e) => setSongForm((p) => ({ ...p, soundCloudUrl: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn-outline" disabled={creatingSong}>Create Song</button>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════ DJ TOP 10 TAB ════════════════════ */

const DJTop10Tab = () => {
  const { data: playlistsData, loading, error, refetch } = useQuery(GET_DJ_TOP10_LISTS);
  const { data: djsData } = useQuery(GET_DJS);
  const { data: songsData, refetch: refetchSongs } = useQuery(GET_SONGS);

  const [createEntry, { loading: creatingEntry }] = useMutation(CREATE_DJ_TOP10_ENTRY);
  const [deleteEntry, { loading: deletingEntry }] = useMutation(DELETE_DJ_TOP10_ENTRY);
  const [createSong, { loading: creatingSong }] = useMutation(CREATE_SONG);

  const playlists: PlaylistGroup[] = useMemo(() => (playlistsData as any)?.djTop10Lists ?? [], [playlistsData]);
  const djs = useMemo(() => (djsData as any)?.dJs ?? [], [djsData]);
  const songs: SongOption[] = useMemo(() => (songsData as any)?.songs ?? [], [songsData]);

  const [djId, setDjId] = useState('');
  const [songId, setSongId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [songForm, setSongForm] = useState({ title: '', artist: '', duration: '' });

  const handleAddEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (!djId || !songId) {
      setFeedback({ type: 'error', text: 'Select both a DJ and a song.' });
      return;
    }
    try {
      await createEntry({ variables: { input: { djId, songId } } });
      await refetch();
      setSongId('');
      setFeedback({ type: 'success', text: 'Track added to DJ Top 10.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add.' });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Remove this track?')) return;
    try {
      await deleteEntry({ variables: { id: entryId } });
      await refetch();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove.' });
    }
  };

  const handleCreateSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songForm.title.trim() || !songForm.artist.trim()) {
      setFeedback({ type: 'error', text: 'Song title and artist are required.' });
      return;
    }
    try {
      const dur = parseInt(songForm.duration, 10);
      const res = await createSong({
        variables: {
          input: {
            title: songForm.title.trim(),
            artist: songForm.artist.trim(),
            duration: Number.isFinite(dur) && dur > 0 ? dur : 0,
          },
        },
      });
      await refetchSongs();
      const newId = res.data?.createSong;
      if (newId) setSongId(newId);
      setSongForm({ title: '', artist: '', duration: '' });
      setFeedback({ type: 'success', text: 'Song added to catalog.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading DJ Top 10 lists...</div>;
  if (error) return <div className="text-red-300">Failed to load: {error.message}</div>;

  return (
    <div className="space-y-8">
      {feedback && (
        <div className={`rounded px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'}`}>
          {feedback.text}
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleAddEntry}>
          <h2 className="text-lg font-semibold">Add Track to DJ</h2>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            DJ
            <select className={selectClass} value={djId} onChange={(e) => setDjId(e.target.value)}>
              <option value="">Select DJ</option>
              {djs.map((dj: any) => (
                <option key={dj.id} value={dj.id}>{dj.stageName || dj.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Song
            <select className={selectClass} value={songId} onChange={(e) => setSongId(e.target.value)}>
              <option value="">Select song</option>
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.artist}{s.duration ? ` (${formatDuration(s.duration)})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={creatingEntry || !djId || !songId}>
            Add to Top 10
          </button>
        </form>

        <form className="card space-y-4" onSubmit={handleCreateSong}>
          <h2 className="text-lg font-semibold">Quick Add Song</h2>
          <input type="text" className={inputClass} placeholder="Title *" value={songForm.title}
            onChange={(e) => setSongForm((p) => ({ ...p, title: e.target.value }))} required />
          <input type="text" className={inputClass} placeholder="Artist *" value={songForm.artist}
            onChange={(e) => setSongForm((p) => ({ ...p, artist: e.target.value }))} required />
          <input type="number" className={inputClass} placeholder="Duration (seconds)" value={songForm.duration}
            onChange={(e) => setSongForm((p) => ({ ...p, duration: e.target.value }))} />
          <button type="submit" className="btn-outline" disabled={creatingSong}>Add Song</button>
        </form>
      </section>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Current DJ Top 10 Lists</h2>
        {playlists.length === 0 && <p className="text-center text-gray-500 py-6">No DJ Top 10 lists yet.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {playlists.map((pl) => (
            <div key={pl.djId} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-xl font-semibold">{pl.djStageName}</h3>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">{pl.top10Songs.length} tracks</p>
              <ul className="space-y-2">
                {pl.top10Songs.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/30 px-3 py-2">
                    <p className="text-sm font-medium">{entry.songTitle}</p>
                    <button type="button" className="text-xs uppercase tracking-wider text-red-400"
                      onClick={() => handleDeleteEntry(entry.id)} disabled={deletingEntry}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPlaylistsPage;
