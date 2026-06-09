import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PLAYLISTS, GET_DJ_TOP10_LISTS, GET_DJS } from '../graphql/queries';
import { ScrollReveal } from '../components/effects/ScrollReveal';

/* ── Types ── */
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
  playlistUrl?: string | null;
  djProfileId?: string | null;
  djName?: string | null;
  songs: PlaylistSong[];
};

type DJProfile = {
  id: string;
  name: string;
  stageName: string;
  profilePictureUrl?: string | null;
  averageRating: number;
  reviewCount: number;
};

type Top10Song = {
  id: string;
  djId: string;
  songId: string;
  songTitle: string;
  song?: {
    artist: string;
    spotifyUrl?: string | null;
    soundCloudUrl?: string | null;
    coverImageUrl?: string | null;
  } | null;
};

type DJTop10List = {
  djId: string;
  djStageName: string;
  top10Songs: Top10Song[];
};

/* ── Helpers ── */
function getEmbedUrl(url: string): string | null {
  if (url.includes('spotify.com')) {
    const match = url.match(/spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
    if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  }
  if (url.includes('soundcloud.com')) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&visual=true`;
  }
  return null;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={`w-3 h-3 ${i <= full ? 'text-orange-400' : i === full + 1 && half ? 'text-orange-400/50' : 'text-gray-600'} fill-current`}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {count > 0 && <span className="text-[0.6rem] text-gray-500 ml-1">({count})</span>}
    </span>
  );
}

/* ── PlaylistCard ── */
const PlaylistCard = ({ playlist, djRating, djReviewCount }: {
  playlist: Playlist;
  djRating?: number;
  djReviewCount?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = playlist.playlistUrl ? getEmbedUrl(playlist.playlistUrl) : null;
  const isSpotify = playlist.playlistUrl?.includes('spotify.com');

  return (
    <article className="liquid-glass rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-orange-400/20 transition-all duration-300">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex gap-4">
          {playlist.coverImageUrl && (
            <div className="relative overflow-hidden rounded-2xl shrink-0 w-20 h-20">
              <img src={playlist.coverImageUrl} alt={playlist.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 space-y-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{playlist.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {playlist.genre && (
                <span className="px-2 py-0.5 rounded-full bg-black/30 border border-white/10 text-[0.6rem] uppercase tracking-wider text-gray-300">
                  {playlist.genre}
                </span>
              )}
              {(playlist.djName || playlist.curator) && (
                <span className="text-xs text-gray-400">by {playlist.djName || playlist.curator}</span>
              )}
            </div>
            {djRating !== undefined && djReviewCount !== undefined && djReviewCount > 0 && (
              <StarRating rating={djRating} count={djReviewCount} />
            )}
            {playlist.description && (
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{playlist.description}</p>
            )}
          </div>
        </div>

        {/* Embed */}
        {embedUrl && (
          <iframe
            src={embedUrl}
            width="100%"
            height={isSpotify ? 152 : 300}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-2xl"
          />
        )}

        {/* Track list toggle */}
        {playlist.songs.length > 0 && (
          <>
            <button
              type="button"
              className="w-full text-center py-1.5 text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-white transition-colors border-t border-white/5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide tracks' : `Show ${playlist.songs.length} tracks`}
            </button>
            {expanded && (
              <ul className="space-y-1.5">
                {playlist.songs.map((song, i) => (
                  <li key={song.id} className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                      {song.coverImageUrl && (
                        <img src={song.coverImageUrl} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{song.title}</p>
                        <p className="text-[0.6rem] text-gray-500 truncate">{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {song.spotifyUrl && (
                        <a href={song.spotifyUrl} target="_blank" rel="noreferrer"
                          className="px-2 py-0.5 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] text-[0.55rem] font-bold uppercase tracking-wider hover:bg-[#1DB954]/20 transition">
                          Spotify
                        </a>
                      )}
                      {song.soundCloudUrl && (
                        <a href={song.soundCloudUrl} target="_blank" rel="noreferrer"
                          className="px-2 py-0.5 rounded-full bg-[#FF5500]/10 border border-[#FF5500]/20 text-[#FF5500] text-[0.55rem] font-bold uppercase tracking-wider hover:bg-[#FF5500]/20 transition">
                          SC
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </article>
  );
};

/* ── DJTopSongs sidebar/tab ── */
const DJTopSongs = ({ lists, djMap }: {
  lists: DJTop10List[];
  djMap: Map<string, DJProfile>;
}) => {
  const [expandedDj, setExpandedDj] = useState<string | null>(null);

  if (lists.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No DJ top picks yet.</p>;
  }

  return (
    <div className="space-y-2">
      {lists.map((list) => {
        const dj = djMap.get(list.djId);
        return (
          <div key={list.djId} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition"
              onClick={() => setExpandedDj(expandedDj === list.djId ? null : list.djId)}
            >
              {dj?.profilePictureUrl && (
                <img src={dj.profilePictureUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{list.djStageName}</p>
                {dj && dj.reviewCount > 0 && (
                  <StarRating rating={dj.averageRating} count={dj.reviewCount} />
                )}
              </div>
              <span className="text-[0.6rem] text-gray-500 shrink-0">{list.top10Songs.length}</span>
              <svg viewBox="0 0 20 20" className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expandedDj === list.djId ? 'rotate-180' : ''}`} fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {expandedDj === list.djId && (
              <ul className="px-4 pb-3 space-y-1.5 border-t border-white/5">
                {list.top10Songs.map((entry, i) => (
                  <li key={entry.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 mt-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[0.6rem] text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                      {entry.song?.coverImageUrl && (
                        <img src={entry.song.coverImageUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{entry.songTitle}</p>
                        {entry.song?.artist && (
                          <p className="text-[0.6rem] text-gray-500 truncate">{entry.song.artist}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      {entry.song?.spotifyUrl && (
                        <a href={entry.song.spotifyUrl} target="_blank" rel="noreferrer"
                          className="text-[#1DB954] hover:opacity-70 transition">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        </a>
                      )}
                      {entry.song?.soundCloudUrl && (
                        <a href={entry.song.soundCloudUrl} target="_blank" rel="noreferrer"
                          className="text-[#FF5500] hover:opacity-70 transition">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.035.104-.094l.2-1.308-.2-1.332c-.015-.057-.047-.094-.104-.094m4.296-1.422c-.27-.087-.556-.135-.854-.135-1.483 0-2.693 1.19-2.726 2.664l-.023 1.258.023 2.699c.005.167.142.3.31.3h3.27c1.318 0 2.386-1.067 2.386-2.386V12.9c0-1.318-1.068-2.386-2.386-2.386"/></svg>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════ MAIN PAGE ════════════════════ */

const PlaylistDiscoveryPage = () => {
  const { data, loading, error } = useQuery(GET_PLAYLISTS);
  const { data: top10Data } = useQuery(GET_DJ_TOP10_LISTS);
  const { data: djData } = useQuery(GET_DJS);

  const playlists: Playlist[] = useMemo(() => data?.playlists ?? [], [data]);
  const top10Lists: DJTop10List[] = useMemo(() => (top10Data as any)?.djTop10Lists ?? [], [top10Data]);
  const djs: DJProfile[] = useMemo(() => (djData as any)?.dJs ?? [], [djData]);
  const djMap = useMemo(() => new Map(djs.map((dj) => [dj.id, dj])), [djs]);
  const djRatingMap = useMemo(() => new Map(djs.map((dj) => [dj.id, { rating: dj.averageRating, count: dj.reviewCount }])), [djs]);

  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [mobileTab, setMobileTab] = useState<'playlists' | 'top10'>('playlists');

  const genres = useMemo(
    () => ['All', ...new Set(playlists.map((p) => p.genre).filter(Boolean) as string[])],
    [playlists],
  );

  const sorted = useMemo(() => {
    return [...playlists].sort((a, b) => {
      const rA = a.djProfileId ? (djRatingMap.get(a.djProfileId)?.rating ?? 0) : -1;
      const rB = b.djProfileId ? (djRatingMap.get(b.djProfileId)?.rating ?? 0) : -1;
      return rB - rA;
    });
  }, [playlists, djRatingMap]);

  const filtered = useMemo(() => {
    if (selectedGenre === 'All') return sorted;
    return sorted.filter((p) => p.genre === selectedGenre);
  }, [selectedGenre, sorted]);

  return (
    <div className="min-h-screen text-white">
      {/* ═══ Hero ═══ */}
      <section className="relative overflow-clip">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-orange-950/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(147,51,234,0.10),transparent_55%)]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-6">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-10 bg-gradient-to-r from-purple-400 to-transparent rounded-full" />
              <p className="text-xs uppercase tracking-[0.5em] text-purple-300/70 font-bold">Playlist Explorer</p>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              Curated playlists,{' '}
              <span className="bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">
                powered by our DJs
              </span>
            </h1>
          </div>

          {/* Genre filters */}
          {genres.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
                    selectedGenre === genre
                      ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black shadow-lg shadow-orange-600/25'
                      : 'border border-white/[0.10] bg-white/[0.04] text-gray-300 hover:border-orange-400/40 hover:text-white'
                  }`}
                  onClick={() => setSelectedGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}

          {/* Mobile tab toggle */}
          <div className="flex lg:hidden gap-1 rounded-xl bg-white/5 p-1 w-fit">
            <button
              type="button"
              onClick={() => setMobileTab('playlists')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mobileTab === 'playlists' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Playlists
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('top10')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mobileTab === 'top10' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
            >
              DJ Top Songs
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Content ═══ */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="flex gap-8">
          {/* ── Main: Playlists ── */}
          <div className={`flex-1 min-w-0 space-y-5 ${mobileTab === 'top10' ? 'hidden lg:block' : ''}`}>
            <div className="flex items-end justify-between mb-2">
              <h2 className="text-xl font-bold">Featured Playlists</h2>
              <p className="text-xs text-gray-500 hidden sm:block">Sorted by DJ rating</p>
            </div>

            {loading && (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mx-auto" />
              </div>
            )}
            {error && <p className="text-red-300 text-sm py-4">Failed to load playlists.</p>}

            {!loading && !error && filtered.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <p className="text-lg font-semibold text-gray-400">
                  {playlists.length === 0 ? 'No playlists yet' : 'No playlists in this genre'}
                </p>
                <p className="text-gray-500 text-sm">Check back soon.</p>
              </div>
            )}

            <div className="space-y-4">
              {filtered.map((playlist, idx) => {
                const djInfo = playlist.djProfileId ? djRatingMap.get(playlist.djProfileId) : undefined;
                return (
                  <ScrollReveal key={playlist.id} delay={idx * 0.06}>
                    <PlaylistCard
                      playlist={playlist}
                      djRating={djInfo?.rating}
                      djReviewCount={djInfo?.count}
                    />
                  </ScrollReveal>
                );
              })}
            </div>
          </div>

          {/* ── Sidebar: DJ Top Songs ── */}
          <aside className={`lg:w-72 xl:w-80 shrink-0 space-y-4 ${mobileTab === 'playlists' ? 'hidden lg:block' : 'w-full'}`}>
            <div className="lg:sticky lg:top-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-6 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
                <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-gray-300">DJ Top Songs</h2>
              </div>
              <div className="rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-4">
                <DJTopSongs lists={top10Lists} djMap={djMap} />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default PlaylistDiscoveryPage;
