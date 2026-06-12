import { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import {
  GET_DJS,
  GET_SONGS,
  GET_DJ_TOP10_LISTS,
  CREATE_DJ_TOP10_ENTRY,
  DELETE_DJ_TOP10_ENTRY,
  CREATE_SONG,
  FETCH_SONG_METADATA,
} from '../../graphql/queries';
import { Music, Plus, Trash2, Search, Star, Disc3 } from 'lucide-react';
import { safeHttpUrl } from '../../lib/safeHttpUrl';

const DJTop10Manager = () => {
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newSpotifyUrl, setNewSpotifyUrl] = useState('');
  const [newSoundCloudUrl, setNewSoundCloudUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const { data: djsData } = useQuery(GET_DJS);
  const { data: songsData, refetch: refetchSongs } = useQuery(GET_SONGS);
  const { data: top10Data, refetch: refetchTop10 } = useQuery(GET_DJ_TOP10_LISTS);

  const [createEntry] = useMutation(CREATE_DJ_TOP10_ENTRY);
  const [deleteEntry] = useMutation(DELETE_DJ_TOP10_ENTRY);
  const [createSong] = useMutation(CREATE_SONG);
  const [fetchMetadata] = useLazyQuery(FETCH_SONG_METADATA);

  useEffect(() => {
    if (djsData?.dJs && user?.id) {
      const profile = djsData.dJs.find(
        (dj: any) => dj.userId === user.id,
      );
      if (profile) setDjId(profile.id);
    }
  }, [djsData, user]);

  const myTop10 = top10Data?.djTop10Lists?.find((list: any) => list.djId === djId);
  const myTop10Songs = myTop10?.top10Songs || [];

  const availableSongs =
    songsData?.songs?.filter(
      (song: any) => !myTop10Songs.some((entry: any) => entry.song?.id === song.id),
    ) || [];

  const filteredSongs = availableSongs.filter(
    (song: any) =>
      song.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddSong = async (songId: string) => {
    if (!djId) return;
    try {
      await createEntry({
        variables: { input: { djId, songId } },
      });
      await refetchTop10();
      setShowAddModal(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding song:', error);
      alert('Failed to add song. Please try again.');
    }
  };

  const handleFetchMetadata = async () => {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    try {
      const result = await fetchMetadata({ variables: { url: fetchUrl.trim() } });
      const m = result.data?.fetchSongMetadata;
      if (m) {
        if (m.title) setNewTitle(m.title);
        if (m.artist) setNewArtist(m.artist);
        if (m.spotifyUrl) setNewSpotifyUrl(m.spotifyUrl);
        if (m.soundCloudUrl) setNewSoundCloudUrl(m.soundCloudUrl);
      } else if (result.error) {
        alert(result.error.message || 'Could not fetch metadata.');
      } else {
        alert('No metadata found for that URL.');
      }
    } catch (err: any) {
      console.error('Fetch metadata error:', err);
      alert(err.message || 'Could not fetch metadata from that URL.');
    } finally {
      setFetching(false);
    }
  };

  const hasUrl = !!(newSpotifyUrl.trim() || newSoundCloudUrl.trim() || fetchUrl.trim());
  const canSubmit = !creating && ((newTitle.trim() && newArtist.trim()) || hasUrl);

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!djId || !canSubmit) return;

    setCreating(true);
    try {
      // Parse duration from MM:SS or just seconds
      let durationSeconds = 0;
      if (newDuration.includes(':')) {
        const [mins, secs] = newDuration.split(':').map(Number);
        durationSeconds = (mins || 0) * 60 + (secs || 0);
      } else if (newDuration) {
        durationSeconds = parseInt(newDuration) || 0;
      }

      // Auto-detect URL type from fetchUrl if specific fields are empty
      let spotifyUrl = newSpotifyUrl.trim() || null;
      let soundCloudUrl = newSoundCloudUrl.trim() || null;
      if (fetchUrl.trim()) {
        if (!spotifyUrl && fetchUrl.includes('spotify.com')) spotifyUrl = fetchUrl.trim();
        if (!soundCloudUrl && fetchUrl.includes('soundcloud.com')) soundCloudUrl = fetchUrl.trim();
      }

      // Create the song
      const { data } = await createSong({
        variables: {
          input: {
            title: newTitle.trim() || null,
            artist: newArtist.trim() || null,
            album: null,
            genre: newGenre.trim() || null,
            duration: durationSeconds,
            spotifyUrl,
            soundCloudUrl,
          },
        },
      });

      const songId = data?.createSong;
      if (!songId) throw new Error('Song creation failed');

      // Add it to top 10
      await createEntry({
        variables: { input: { djId, songId } },
      });

      await refetchSongs();
      await refetchTop10();

      // Reset form
      setNewTitle('');
      setNewArtist('');
      setNewGenre('');
      setNewDuration('');
      setNewSpotifyUrl('');
      setNewSoundCloudUrl('');
      setFetchUrl('');
      setShowCreateForm(false);
      setShowAddModal(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating song:', error);
      alert('Failed to create song. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveSong = async (entryId: string) => {
    if (!confirm('Remove this track from your Top 10?')) return;
    try {
      await deleteEntry({ variables: { id: entryId } });
      await refetchTop10();
    } catch (error) {
      console.error('Error removing song:', error);
      alert('Failed to remove song. Please try again.');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Top 10 Tracks</h1>
            <p className="text-gray-400">
              Curate your signature sound and showcase your musical identity
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={myTop10Songs.length >= 10}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF6B35] to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Track
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">{myTop10Songs.length}/10</div>
            <div className="text-sm text-gray-400">Tracks Added</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">{availableSongs.length}</div>
            <div className="text-sm text-gray-400">Available Tracks</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="text-3xl font-bold text-white mb-1">--</div>
            <div className="text-sm text-gray-400">Total Plays</div>
          </div>
        </div>

        {/* Current Top 10 */}
        <section className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Music className="w-5 h-5" />
              Your Top 10
            </h2>
            <span className="text-sm text-gray-400">
              {myTop10Songs.length === 10
                ? 'Complete!'
                : `${10 - myTop10Songs.length} slots remaining`}
            </span>
          </div>

          {myTop10Songs.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-2">Your Top 10 is empty</p>
              <p className="text-sm text-gray-500 mb-6">
                Start building your signature sound by adding tracks
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-orange-500/30 text-orange-400 transition"
              >
                Add Your First Track
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTop10Songs.map((entry: any, index: number) => (
                <div
                  key={entry.id}
                  className="bg-black/30 border border-white/10 rounded-lg p-4 hover:bg-black/40 transition flex items-center gap-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-orange-500 flex items-center justify-center font-bold text-lg">
                    {index + 1}
                  </div>

                  {entry.song?.coverImageUrl && (
                    <img
                      src={entry.song.coverImageUrl}
                      alt={entry.song.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {entry.song?.title || 'Unknown Track'}
                    </h3>
                    <p className="text-sm text-gray-400 truncate">
                      {entry.song?.artist || 'Unknown Artist'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {safeHttpUrl(entry.song?.spotifyUrl) && (
                      <a
                        href={safeHttpUrl(entry.song?.spotifyUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 transition"
                        title="Listen on Spotify"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                      </a>
                    )}
                    {safeHttpUrl(entry.song?.soundCloudUrl) && (
                      <a
                        href={safeHttpUrl(entry.song?.soundCloudUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 transition"
                        title="Listen on SoundCloud"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.194-1.308-.194-1.332c-.014-.057-.047-.094-.104-.094m1.81-.78c-.067 0-.12.054-.127.116l-.217 2.09.217 2.063c.007.065.06.116.127.116.066 0 .12-.05.126-.116l.241-2.063-.241-2.09c-.006-.062-.06-.116-.126-.116m.891-.278c-.074 0-.133.062-.14.138l-.202 2.368.202 2.087c.007.074.066.135.14.135.076 0 .135-.061.14-.135l.228-2.087-.228-2.368c-.005-.076-.064-.138-.14-.138m.904-.118c-.08 0-.143.068-.148.15l-.19 2.486.19 2.075c.005.08.068.148.148.148.08 0 .142-.068.15-.148l.213-2.075-.214-2.486c-.008-.082-.07-.15-.15-.15m.89.044c-.09 0-.158.074-.163.163l-.178 2.442.178 2.058c.005.09.074.161.164.161.088 0 .157-.072.163-.161l.2-2.058-.2-2.442c-.006-.09-.075-.163-.163-.163m.908-.18c-.094 0-.17.08-.176.176l-.165 2.622.165 2.04c.006.094.082.174.176.174s.17-.08.177-.174l.186-2.04-.186-2.622c-.007-.096-.083-.176-.177-.176m.926-.2c-.104 0-.184.088-.19.192l-.151 2.822.151 2.018c.006.103.086.19.19.19.103 0 .184-.087.19-.19l.17-2.018-.17-2.822c-.006-.104-.087-.192-.19-.192m.94-.12c-.107 0-.194.094-.2.206l-.14 2.942.14 1.993c.006.11.093.202.2.202.11 0 .197-.09.204-.202l.155-1.993-.156-2.942c-.006-.112-.093-.206-.203-.206m2.852-1.578c-.106 0-.19.088-.196.197l-.14 4.52.14 1.96c.006.107.09.195.197.195.108 0 .192-.088.197-.195l.16-1.96-.16-4.52c-.005-.11-.09-.197-.198-.197m-1.907 1.15c-.116 0-.206.1-.212.218l-.127 3.37.127 1.975c.006.116.096.215.212.215.117 0 .207-.1.212-.215l.144-1.975-.144-3.37c-.005-.12-.095-.218-.212-.218m.945-.304c-.12 0-.22.108-.224.232l-.118 3.674.118 1.964c.005.122.103.228.224.228.12 0 .218-.106.224-.228l.132-1.964-.132-3.674c-.006-.124-.104-.232-.224-.232m3.753-.897c-.065 0-.127.017-.182.05-.093-.608-.513-1.087-1.065-1.27-.145-.048-.3-.073-.459-.073-1.047 0-4.757 0-4.757 0-.12.005-.215.103-.215.225v7.94c0 .126.1.228.224.232h6.454c1.16 0 2.1-.94 2.1-2.1 0-1.16-.94-2.1-2.1-2.1"/></svg>
                      </a>
                    )}
                    {entry.song?.duration > 0 && (
                      <span className="text-xs text-gray-500">
                        {Math.floor(entry.song.duration / 60)}:
                        {String(entry.song.duration % 60).padStart(2, '0')}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveSong(entry.id)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tips */}
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Pro Tips
          </h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• Your Top 10 is displayed prominently on your public profile</li>
            <li>• Update regularly to keep your profile fresh and engaging</li>
            <li>• Choose tracks that represent your signature sound and style</li>
            <li>• Mix classics with current favorites for a well-rounded showcase</li>
          </ul>
        </div>

        {/* Add Song Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Add Track to Top 10</h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowCreateForm(false);
                      setSearchQuery('');
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition"
                  >
                    <span className="text-2xl text-gray-400">&times;</span>
                  </button>
                </div>

                {/* Toggle between search and create */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                      !showCreateForm
                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Search Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                      showCreateForm
                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Plus className="w-4 h-4" />
                      Add New Song
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {showCreateForm ? (
                  /* ─── Create New Song Form ─── */
                  <form onSubmit={handleCreateAndAdd} noValidate className="space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Disc3 className="w-8 h-8 text-orange-400" />
                      <div>
                        <p className="text-white font-semibold">Create a New Track</p>
                        <p className="text-xs text-gray-500">
                          Paste a URL to auto-fill details, or enter manually
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Paste a Spotify or SoundCloud URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={fetchUrl}
                          onChange={(e) => setFetchUrl(e.target.value)}
                          placeholder="https://open.spotify.com/track/... or https://soundcloud.com/..."
                          className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleFetchMetadata}
                          disabled={!fetchUrl.trim() || fetching}
                          className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-semibold hover:shadow-lg transition disabled:opacity-50 whitespace-nowrap"
                        >
                          {fetching ? 'Fetching...' : 'Fetch'}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4" />

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Song Title {hasUrl ? '' : '*'}
                      </label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Strobe"
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">Artist {hasUrl ? '' : '*'}</label>
                      <input
                        type="text"
                        value={newArtist}
                        onChange={(e) => setNewArtist(e.target.value)}
                        placeholder="e.g. deadmau5"
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Genre</label>
                        <input
                          type="text"
                          value={newGenre}
                          onChange={(e) => setNewGenre(e.target.value)}
                          placeholder="e.g. Progressive House"
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">
                          Duration (MM:SS)
                        </label>
                        <input
                          type="text"
                          value={newDuration}
                          onChange={(e) => setNewDuration(e.target.value)}
                          placeholder="e.g. 3:45"
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Spotify URL
                      </label>
                      <input
                        type="text"
                        value={newSpotifyUrl}
                        onChange={(e) => setNewSpotifyUrl(e.target.value)}
                        placeholder="https://open.spotify.com/track/..."
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-green-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        SoundCloud URL
                      </label>
                      <input
                        type="text"
                        value={newSoundCloudUrl}
                        onChange={(e) => setNewSoundCloudUrl(e.target.value)}
                        placeholder="https://soundcloud.com/..."
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-400 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white font-bold uppercase tracking-wider hover:shadow-[0_0_25px_rgba(255,107,53,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? 'Creating...' : 'Create & Add to Top 10'}
                    </button>
                  </form>
                ) : (
                  /* ─── Search Existing Songs ─── */
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tracks by title or artist..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      {filteredSongs.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                          <Music className="w-12 h-12 mx-auto text-gray-600" />
                          <p className="text-gray-400">
                            {availableSongs.length === 0
                              ? 'No songs in the library yet'
                              : 'No tracks match your search'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Switch to "Add New Song" to create a track
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowCreateForm(true)}
                            className="px-5 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-semibold hover:bg-orange-500/30 transition"
                          >
                            <span className="flex items-center gap-1.5">
                              <Plus className="w-4 h-4" />
                              Add New Song
                            </span>
                          </button>
                        </div>
                      ) : (
                        filteredSongs.map((song: any) => (
                          <button
                            key={song.id}
                            onClick={() => handleAddSong(song.id)}
                            className="w-full bg-black/30 hover:bg-black/50 border border-white/10 hover:border-orange-500/30 rounded-xl p-4 transition flex items-center gap-4 text-left"
                          >
                            {song.coverImageUrl ? (
                              <img
                                src={song.coverImageUrl}
                                alt={song.title}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                                <Music className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate">{song.title}</h3>
                              <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                            </div>
                            {song.duration > 0 && (
                              <span className="text-xs text-gray-500">
                                {Math.floor(song.duration / 60)}:
                                {String(song.duration % 60).padStart(2, '0')}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DJTop10Manager;
