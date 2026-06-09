import { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import ImageUpload from '../../components/common/ImageUpload';
import { useAuth } from '../../context/AuthContext';
import {
  GET_DJS,
  GET_MY_DJ_PLAYLISTS,
  GET_SONGS,
  CREATE_PLAYLIST,
  UPDATE_PLAYLIST,
  DELETE_PLAYLIST,
  ADD_PLAYLIST_SONG,
  REMOVE_PLAYLIST_SONG,
  CREATE_SONG,
  FETCH_SONG_METADATA,
} from '../../graphql/queries';
import {
  ListMusic,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Search,
  Music,
  X,
  Save,
} from 'lucide-react';

type PlaylistSong = {
  id: string;
  songId: string;
  position: number;
  title: string;
  artist: string;
  genre?: string | null;
  coverImageUrl?: string | null;
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
  djProfileId?: string | null;
  djName?: string | null;
  playlistUrl?: string | null;
  songs: PlaylistSong[];
};

const DJPlaylistsManager = () => {
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddSongModal, setShowAddSongModal] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState('');
  const [showNewSongForm, setShowNewSongForm] = useState(false);

  // Form state for create/edit playlist
  const [form, setForm] = useState({ title: '', description: '', genre: '', coverImageUrl: '', playlistUrl: '' });
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);

  // New song form
  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    genre: '',
    coverImageUrl: '',
    spotifyUrl: '',
    soundCloudUrl: '',
  });
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const { data: djsData } = useQuery(GET_DJS);
  const { data: playlistsData, refetch: refetchPlaylists } = useQuery(GET_MY_DJ_PLAYLISTS, {
    variables: { djProfileId: djId },
    skip: !djId,
  });
  const { data: songsData, refetch: refetchSongs } = useQuery(GET_SONGS);

  const [createPlaylist] = useMutation(CREATE_PLAYLIST);
  const [updatePlaylist] = useMutation(UPDATE_PLAYLIST);
  const [deletePlaylist] = useMutation(DELETE_PLAYLIST);
  const [addPlaylistSong] = useMutation(ADD_PLAYLIST_SONG);
  const [removePlaylistSong] = useMutation(REMOVE_PLAYLIST_SONG);
  const [createSong] = useMutation(CREATE_SONG);
  const [fetchMetadata] = useLazyQuery(FETCH_SONG_METADATA);

  useEffect(() => {
    if (djsData?.dJs) {
      const profile = djsData.dJs.find(
        (dj: any) => dj.userId === user?.id,
      );
      if (profile) setDjId(profile.id);
    }
  }, [djsData, user]);

  const playlists: Playlist[] = playlistsData?.myDjPlaylists ?? [];
  const allSongs = songsData?.songs ?? [];

  const handleFetchPlaylistMetadata = async () => {
    if (!form.playlistUrl.trim()) return;
    setFetchingPlaylist(true);
    try {
      const { data } = await fetchMetadata({ variables: { url: form.playlistUrl.trim() } });
      if (data?.fetchSongMetadata) {
        const m = data.fetchSongMetadata;
        setForm((p) => ({
          ...p,
          title: p.title || m.title || '',
          coverImageUrl: p.coverImageUrl || m.coverImageUrl || '',
        }));
      }
    } catch (err: any) {
      alert(err.message || 'Could not fetch playlist details.');
    } finally {
      setFetchingPlaylist(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!djId) return;
    if (!form.playlistUrl.trim() && !form.title.trim()) return;
    try {
      await createPlaylist({
        variables: {
          input: {
            title: form.title.trim() || 'Untitled Playlist',
            description: form.description || null,
            genre: form.genre || null,
            coverImageUrl: form.coverImageUrl || null,
            curator: user?.fullName || null,
            djProfileId: djId,
            playlistUrl: form.playlistUrl || null,
          },
        },
      });
      setForm({ title: '', description: '', genre: '', coverImageUrl: '', playlistUrl: '' });
      setShowCreateForm(false);
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to create playlist');
    }
  };

  const handleUpdatePlaylist = async (id: string) => {
    if (!form.playlistUrl.trim() && !form.title.trim()) return;
    try {
      await updatePlaylist({
        variables: {
          id,
          input: {
            title: form.title.trim() || 'Untitled Playlist',
            description: form.description || null,
            genre: form.genre || null,
            coverImageUrl: form.coverImageUrl || null,
            curator: user?.fullName || null,
            playlistUrl: form.playlistUrl || null,
          },
        },
      });
      setEditingId(null);
      setForm({ title: '', description: '', genre: '', coverImageUrl: '', playlistUrl: '' });
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to update playlist');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist({ variables: { id } });
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to delete playlist');
    }
  };

  const handleAddSong = async (playlistId: string, songId: string, position: number) => {
    try {
      await addPlaylistSong({
        variables: { input: { playlistId, songId, position } },
      });
      setShowAddSongModal(null);
      setSongSearch('');
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to add song');
    }
  };

  const handleRemoveSong = async (playlistSongId: string) => {
    try {
      await removePlaylistSong({ variables: { id: playlistSongId } });
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to remove song');
    }
  };

  const handleFetchMetadata = async () => {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    try {
      const { data } = await fetchMetadata({ variables: { url: fetchUrl.trim() } });
      if (data?.fetchSongMetadata) {
        const m = data.fetchSongMetadata;
        setNewSong({
          title: m.title || '',
          artist: m.artist || '',
          genre: '',
          coverImageUrl: m.coverImageUrl || '',
          spotifyUrl: m.spotifyUrl || '',
          soundCloudUrl: m.soundCloudUrl || '',
        });
      }
    } catch (err: any) {
      alert(err.message || 'Could not fetch metadata from that URL.');
    } finally {
      setFetching(false);
    }
  };

  const handleCreateSong = async (playlistId: string, currentSongCount: number) => {
    const songHasUrl = !!(newSong.spotifyUrl?.trim() || newSong.soundCloudUrl?.trim() || fetchUrl.trim());
    if (!newSong.title.trim() && !newSong.artist.trim() && !songHasUrl) return;
    try {
      // Auto-detect URL type from fetchUrl if specific fields are empty
      let spotifyUrl = newSong.spotifyUrl?.trim() || null;
      let soundCloudUrl = newSong.soundCloudUrl?.trim() || null;
      if (fetchUrl.trim()) {
        if (!spotifyUrl && fetchUrl.includes('spotify.com')) spotifyUrl = fetchUrl.trim();
        if (!soundCloudUrl && fetchUrl.includes('soundcloud.com')) soundCloudUrl = fetchUrl.trim();
      }

      const { data } = await createSong({
        variables: {
          input: {
            title: newSong.title.trim() || null,
            artist: newSong.artist.trim() || null,
            genre: newSong.genre || null,
            coverImageUrl: newSong.coverImageUrl || null,
            spotifyUrl,
            soundCloudUrl,
          },
        },
      });
      if (data?.createSong) {
        await addPlaylistSong({
          variables: {
            input: {
              playlistId,
              songId: data.createSong,
              position: currentSongCount + 1,
            },
          },
        });
      }
      setNewSong({ title: '', artist: '', genre: '', coverImageUrl: '', spotifyUrl: '', soundCloudUrl: '' });
      setFetchUrl('');
      setShowNewSongForm(false);
      setShowAddSongModal(null);
      refetchSongs();
      refetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to create song');
    }
  };

  const startEdit = (playlist: Playlist) => {
    setEditingId(playlist.id);
    setForm({
      title: playlist.title,
      description: playlist.description || '',
      genre: playlist.genre || '',
      coverImageUrl: playlist.coverImageUrl || '',
      playlistUrl: playlist.playlistUrl || '',
    });
  };

  if (!djId) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Loading your DJ profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">DJ Portal</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-orange-400" />
            My Playlists
          </h1>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingId(null);
            setForm({ title: '', description: '', genre: '', coverImageUrl: '', playlistUrl: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black text-sm font-semibold hover:shadow-lg hover:shadow-orange-500/25 transition"
        >
          <Plus className="w-4 h-4" />
          New Playlist
        </button>
      </header>

      {/* Create/Edit Form */}
      {(showCreateForm || editingId) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {editingId ? 'Edit Playlist' : 'Create Playlist'}
          </h2>

          {/* URL first — paste to auto-fill everything */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
              Spotify / SoundCloud Playlist URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.playlistUrl}
                onChange={(e) => setForm({ ...form, playlistUrl: e.target.value })}
                className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                placeholder="https://open.spotify.com/playlist/... or https://soundcloud.com/..."
              />
              <button
                type="button"
                onClick={handleFetchPlaylistMetadata}
                disabled={!form.playlistUrl.trim() || fetchingPlaylist}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-semibold hover:shadow-lg transition disabled:opacity-50 whitespace-nowrap"
              >
                {fetchingPlaylist ? 'Fetching…' : 'Fetch Details'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                Title <span className="normal-case text-gray-500">(auto-filled from URL)</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                placeholder="Auto-filled or enter manually"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                Genre
              </label>
              <input
                type="text"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                placeholder="House, Techno, etc."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                rows={2}
                placeholder="A short description of this playlist..."
              />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                currentImageUrl={form.coverImageUrl}
                onImageUploaded={(url) => setForm({ ...form, coverImageUrl: url })}
                folder="playlists"
                label="Cover Image (auto-fetched from URL)"
                aspectRatio="aspect-square"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() =>
                editingId ? handleUpdatePlaylist(editingId) : handleCreatePlaylist()
              }
              disabled={!form.playlistUrl.trim() && !form.title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black text-sm font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Save Changes' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setEditingId(null);
                setForm({ title: '', description: '', genre: '', coverImageUrl: '', playlistUrl: '' });
              }}
              className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Playlists List */}
      {playlists.length === 0 && !showCreateForm && (
        <div className="text-center py-16 space-y-3">
          <ListMusic className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-lg text-gray-400">No playlists yet</p>
          <p className="text-sm text-gray-500">
            Create your first playlist to share your curated music with fans.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
          >
            {/* Playlist header */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <button
                onClick={() =>
                  setExpandedId(expandedId === playlist.id ? null : playlist.id)
                }
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                {playlist.coverImageUrl && (
                  <img
                    src={playlist.coverImageUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{playlist.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {playlist.genre && <span>{playlist.genre}</span>}
                    <span>{playlist.songs.length} tracks</span>
                  </div>
                </div>
                {expandedId === playlist.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(playlist)}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-orange-500/30 transition"
                  title="Edit playlist"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePlaylist(playlist.id)}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition"
                  title="Delete playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded: song list */}
            {expandedId === playlist.id && (
              <div className="border-t border-white/5 px-4 sm:px-5 pb-4 space-y-3">
                {playlist.description && (
                  <p className="text-sm text-gray-400 pt-3">{playlist.description}</p>
                )}

                {playlist.songs.length > 0 && (
                  <ul className="space-y-1.5 pt-2">
                    {playlist.songs.map((song, i) => (
                      <li
                        key={song.id}
                        className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs text-gray-600 w-5 text-right shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {song.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {song.spotifyUrl && (
                            <span className="text-[0.6rem] text-[#1DB954] uppercase tracking-wider">
                              Spotify
                            </span>
                          )}
                          {song.soundCloudUrl && (
                            <span className="text-[0.6rem] text-[#FF5500] uppercase tracking-wider">
                              SC
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveSong(song.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition"
                            title="Remove from playlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {playlist.songs.length === 0 && (
                  <p className="text-sm text-gray-500 pt-3 text-center">
                    No songs yet. Add some tracks to get started.
                  </p>
                )}

                <button
                  onClick={() => {
                    setShowAddSongModal(playlist.id);
                    setSongSearch('');
                    setShowNewSongForm(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 text-gray-400 text-sm hover:text-white hover:border-orange-500/30 transition w-full justify-center mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Song
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Song Modal */}
      {showAddSongModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Song to Playlist</h3>
              <button
                onClick={() => {
                  setShowAddSongModal(null);
                  setShowNewSongForm(false);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!showNewSongForm ? (
              <>
                {/* Search existing songs */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={songSearch}
                    onChange={(e) => setSongSearch(e.target.value)}
                    placeholder="Search songs..."
                    className="w-full rounded-lg border border-white/10 bg-black/50 pl-9 pr-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {(() => {
                    const currentPlaylist = playlists.find(
                      (p) => p.id === showAddSongModal,
                    );
                    const existingSongIds = new Set(
                      currentPlaylist?.songs.map((s) => s.songId) ?? [],
                    );
                    const filtered = allSongs.filter(
                      (s: any) =>
                        !existingSongIds.has(s.id) &&
                        (s.title?.toLowerCase().includes(songSearch.toLowerCase()) ||
                          s.artist?.toLowerCase().includes(songSearch.toLowerCase())),
                    );
                    if (filtered.length === 0)
                      return (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No matching songs found.
                        </p>
                      );
                    return filtered.map((song: any) => (
                      <button
                        key={song.id}
                        onClick={() =>
                          handleAddSong(
                            showAddSongModal,
                            song.id,
                            (currentPlaylist?.songs.length ?? 0) + 1,
                          )
                        }
                        className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-white/5 transition"
                      >
                        <Music className="w-4 h-4 text-gray-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{song.title}</p>
                          <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        </div>
                        {song.spotifyUrl && (
                          <span className="text-[0.5rem] text-[#1DB954] uppercase ml-auto shrink-0">
                            Spotify
                          </span>
                        )}
                        {song.soundCloudUrl && (
                          <span className="text-[0.5rem] text-[#FF5500] uppercase shrink-0">
                            SC
                          </span>
                        )}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  onClick={() => setShowNewSongForm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 text-gray-400 text-sm hover:text-white hover:border-orange-500/30 transition w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Create New Song
                </button>
              </>
            ) : (
              /* New song form with URL auto-fetch */
              <div className="space-y-3">
                {/* URL paste + fetch */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Paste a Spotify or SoundCloud URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fetchUrl}
                      onChange={(e) => setFetchUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/... or https://soundcloud.com/..."
                      className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      onClick={handleFetchMetadata}
                      disabled={!fetchUrl.trim() || fetching}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-semibold hover:shadow-lg transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {fetching ? 'Fetching...' : 'Fetch Details'}
                    </button>
                  </div>
                </div>

                {newSong.coverImageUrl && (
                  <div className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/5 p-2">
                    <img
                      src={newSong.coverImageUrl}
                      alt="Cover"
                      className="w-12 h-12 rounded-md object-cover shrink-0"
                    />
                    <p className="text-xs text-gray-400">Cover image fetched</p>
                  </div>
                )}

                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Details auto-filled from URL, or enter manually. URL alone is enough to add a song.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={newSong.title}
                      onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Artist</label>
                    <input
                      type="text"
                      value={newSong.artist}
                      onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Genre</label>
                    <input
                      type="text"
                      value={newSong.genre}
                      onChange={(e) => setNewSong({ ...newSong, genre: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Spotify URL</label>
                    <input
                      type="text"
                      value={newSong.spotifyUrl}
                      onChange={(e) => setNewSong({ ...newSong, spotifyUrl: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="https://open.spotify.com/track/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">SoundCloud URL</label>
                    <input
                      type="text"
                      value={newSong.soundCloudUrl}
                      onChange={(e) =>
                        setNewSong({ ...newSong, soundCloudUrl: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="https://soundcloud.com/..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const p = playlists.find((pl) => pl.id === showAddSongModal);
                      handleCreateSong(showAddSongModal!, p?.songs.length ?? 0);
                    }}
                    disabled={!newSong.title.trim() && !newSong.artist.trim() && !newSong.spotifyUrl?.trim() && !newSong.soundCloudUrl?.trim() && !fetchUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black text-sm font-semibold hover:shadow-lg transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Create & Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewSongForm(false);
                      setFetchUrl('');
                      setNewSong({ title: '', artist: '', genre: '', coverImageUrl: '', spotifyUrl: '', soundCloudUrl: '' });
                    }}
                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:text-white transition"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DJPlaylistsManager;
