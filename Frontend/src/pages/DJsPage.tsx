import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { FOLLOW_DJ, GET_DJS, GET_FOLLOWED_DJS, UNFOLLOW_DJ, GET_DJ_APPLICATION_BY_USER, GET_DJ_TOP10_LISTS } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import DJApplicationForm from '../components/DJApplicationForm';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import { Star, Music, CalendarDays } from 'lucide-react';

type DJ = {
  id: string;
  name: string;
  stageName: string;
  bio: string;
  genre: string;
  profilePictureUrl?: string;
  coverImageUrl?: string;
  tagline?: string;
  followerCount: number;
  averageRating: number;
  reviewCount: number;
  specialties?: string;
  achievements?: string;
  yearsExperience?: number;
  influencedBy?: string;
  upcomingEvents?: { eventId: string; title: string; date: string; venueName: string; city?: string }[];
};

const SongTicker = ({ tracks }: { tracks: { title: string; artist: string }[] }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (tracks.length <= 1) return;
    const timer = setInterval(() => setIndex((p) => (p + 1) % tracks.length), 2800);
    return () => clearInterval(timer);
  }, [tracks.length]);

  if (tracks.length === 0) return null;
  const track = tracks[index];

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <Music className="w-3 h-3 text-orange-400 flex-shrink-0" />
      <div key={`${track.title}-${index}`} className="flex-1 min-w-0 animate-fade-in">
        <span className="text-[0.65rem] text-gray-300 truncate block">{track.title}</span>
        {track.artist && <span className="text-[0.55rem] text-gray-500 truncate block">{track.artist}</span>}
      </div>
      {tracks.length > 1 && (
        <span className="text-[0.5rem] text-gray-600 flex-shrink-0 tabular-nums">{index + 1}/{tracks.length}</span>
      )}
    </div>
  );
};

const DJHighlights = ({ dj }: { dj: DJ }) => {
  const [index, setIndex] = useState(0);
  const highlights = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (dj.specialties) items.push({ label: 'Specialties', value: dj.specialties });
    if (dj.achievements) items.push({ label: 'Achievements', value: dj.achievements });
    if (dj.yearsExperience) items.push({ label: 'Experience', value: `${dj.yearsExperience} yrs` });
    if (dj.influencedBy) items.push({ label: 'Influenced by', value: dj.influencedBy });
    return items;
  }, [dj]);

  useEffect(() => {
    if (highlights.length <= 1) return;
    const timer = setInterval(() => setIndex((p) => (p + 1) % highlights.length), 3500);
    return () => clearInterval(timer);
  }, [highlights.length]);

  if (highlights.length === 0) return null;
  const current = highlights[index];

  return (
    <div className="px-1">
      <div
        key={`${current.label}-${index}`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-400/15 animate-fade-in"
      >
        <span className="text-[0.5rem] uppercase tracking-wider text-orange-400/70 font-bold whitespace-nowrap flex-shrink-0">
          {current.label}
        </span>
        <span className="text-[0.62rem] text-gray-300 truncate">{current.value}</span>
      </div>
      {highlights.length > 1 && (
        <div className="flex justify-center gap-1 mt-1.5">
          {highlights.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-2.5 bg-orange-400' : 'w-1 bg-white/15'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

const sortOptions = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'name', label: 'Name (A-Z)' },
];

const DJsPage = () => {
  const { user, isAuthenticated, isDJ, isAdmin } = useAuth();
  const { siteSettings } = useSiteSettings();
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'name'>('popularity');
  const [ctaMessage, setCtaMessage] = useState<string | null>(null);
  const [isApplicationFormOpen, setIsApplicationFormOpen] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);

  const resolvedUserId = useMemo(() => {
    if (user?.id) return user.id;
    if (typeof window === 'undefined') return '';
    const storageKey = 'dj-dip-guest-user-id';
    let stored = localStorage.getItem(storageKey);
    if (!stored) {
      stored =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `guest-${Date.now()}`;
      localStorage.setItem(storageKey, stored);
    }
    return stored;
  }, [user?.id]);

  const { data, loading, error } = useQuery(GET_DJS);
  const {
    data: followedData,
    refetch: refetchFollowed,
    loading: followLoading,
  } = useQuery(GET_FOLLOWED_DJS, {
    variables: { userId: resolvedUserId },
    skip: !resolvedUserId,
  });

  const [followDjMutation, { loading: followMutationLoading }] = useMutation(FOLLOW_DJ);
  const [unfollowDjMutation, { loading: unfollowMutationLoading }] = useMutation(UNFOLLOW_DJ);

  const { data: applicationData, refetch: refetchApplication } = useQuery(GET_DJ_APPLICATION_BY_USER, {
    variables: { userId: user?.id || '' },
    skip: !user?.id,
  });

  const { data: top10Data } = useQuery(GET_DJ_TOP10_LISTS);

  const userApplication = applicationData?.djApplicationByUser;
  const isAlreadyDJ = isDJ || isAdmin;
  const defaultDjImage = siteSettings.defaultDjImageUrl ?? '/media/defaults/dj.svg';

  const followedIds = useMemo(() => {
    if (!followedData?.followedDjs) return new Set<string>();
    return new Set<string>(followedData.followedDjs.map((dj: DJ) => dj.id));
  }, [followedData]);

  const top10ByDj = useMemo(() => {
    const map = new Map<string, { title: string; artist: string }[]>();
    if (!top10Data?.djTop10Lists) return map;
    for (const list of top10Data.djTop10Lists) {
      const tracks = (list.top10Songs || []).map((entry: any) => ({
        title: entry.song?.title || entry.songTitle || 'Unknown',
        artist: entry.song?.artist || '',
      }));
      if (tracks.length > 0) map.set(list.djId, tracks);
    }
    return map;
  }, [top10Data]);

  const genreOptions = useMemo(() => {
    if (!data?.dJs) return [];
    const genres = new Set<string>();
    data.dJs.forEach((dj: DJ) =>
      dj.genre
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => genres.add(g)),
    );
    return Array.from(genres).sort();
  }, [data]);

  const filteredDjs: DJ[] = useMemo(() => {
    if (!data?.dJs) return [];
    return [...data.dJs]
      .filter((dj: DJ) => {
        const matchesSearch =
          dj.stageName.toLowerCase().includes(search.toLowerCase()) ||
          dj.bio.toLowerCase().includes(search.toLowerCase());
        const matchesGenre =
          genreFilter === 'all' ||
          dj.genre
            .split(',')
            .map((g) => g.trim().toLowerCase())
            .includes(genreFilter.toLowerCase());
        return matchesSearch && matchesGenre;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.stageName.localeCompare(b.stageName);
        }
        return b.followerCount - a.followerCount;
      });
  }, [data, search, genreFilter, sortBy]);

  const handleFollowToggle = async (dj: DJ, currentlyFollowing: boolean) => {
    if (!isAuthenticated) {
      setCtaMessage('Following as a guest — create an account later to sync across devices.');
    } else {
      setCtaMessage(null);
    }

    const variables = { input: { userId: resolvedUserId, djId: dj.id } };
    if (currentlyFollowing) {
      await unfollowDjMutation({ variables });
    } else {
      await followDjMutation({ variables });
    }

    await refetchFollowed();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center space-y-2 px-6">
        <p className="text-orange-400 text-lg">Unable to load DJ roster</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="DJs — Oslo's Best Club Artists"
        description="Discover Oslo's top DJs. Browse profiles, genres, upcoming sets, and book your favourite artists through KlubN."
        canonical="/djs"
      />
      {/* Hero with orange-burgundy gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5D1725]/30 via-transparent to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,rgba(93,23,37,0.15),transparent_55%)]" />

        <section className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
              <p className="text-sm uppercase tracking-[0.6em] text-orange-400 font-bold">Digital Residency</p>
            </div>
            <h1 className="font-display text-6xl md:text-7xl font-black leading-tight tracking-tight">
              Curated{' '}
              <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-[#FF6B35] bg-clip-text text-transparent">
                DJ Roster
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-3xl leading-relaxed">
              Deep dives into the selectors shaping nightlife. Explore full bios, sonic influences, and follow the artists
              powering the KlubN ecosystem.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 pt-6">
            {[
              { value: data?.dJs?.length ?? 0, label: 'Profiles' },
              { value: genreOptions.length, label: 'Genres' },
              { value: followedIds.size, label: 'You Follow' },
            ].map(({ value, label }) => (
              <div key={label} className="group">
                <p className="text-4xl font-black bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent group-hover:from-orange-400 group-hover:to-orange-300 transition-all duration-300">
                  {value}
                </p>
                <p className="text-xs uppercase tracking-[0.5em] text-gray-500 group-hover:text-orange-400 transition-colors">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Apply as DJ */}
          {isAuthenticated && !isAlreadyDJ && (
            <div className="pt-8">
              {userApplication ? (
                <div className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-950/50 to-orange-950/50 border border-amber-900/30">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">
                        Application{' '}
                        {userApplication.status === 0
                          ? 'Pending Review'
                          : userApplication.status === 2
                          ? 'Rejected'
                          : 'Approved'}
                      </p>
                      <p className="text-xs text-amber-500/70">
                        Submitted {new Date(userApplication.submittedAt).toLocaleDateString()}
                      </p>
                      {userApplication.rejectionReason && (
                        <p className="text-xs text-red-400 mt-1">Reason: {userApplication.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : applicationSuccess ? (
                <div className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-green-950/50 to-emerald-950/50 border border-green-900/30">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-bold text-green-300">Application Submitted Successfully!</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsApplicationFormOpen(true)}
                  className="group px-8 py-4 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white hover:shadow-[0_0_40px_rgba(255,107,53,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-3"
                >
                  <svg
                    className="w-5 h-5 group-hover:rotate-12 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Apply as a DJ
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-12">
        <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm uppercase tracking-[0.4em] text-gray-500 mb-3 font-bold">Search</label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, style, or bio..."
                className="w-full px-6 py-4 rounded-2xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.4em] text-gray-500 mb-3 font-bold">Genre</label>
              <select
                value={genreFilter}
                onChange={(event) => setGenreFilter(event.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Styles</option>
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.4em] text-gray-500 mb-3 font-bold">Sort</label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'popularity' | 'name')}
                className="w-full px-6 py-4 rounded-2xl bg-black/60 border border-white/10 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all appearance-none cursor-pointer"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {ctaMessage && <p className="text-sm text-orange-300">{ctaMessage}</p>}
        </div>
      </section>

      {/* DJ Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        {filteredDjs.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-2xl font-semibold text-gray-400">No profiles match those filters yet.</p>
            <p className="text-gray-500">Try another genre or reset your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDjs.map((dj) => {
              const isFollowing = followedIds.has(dj.id);
              const genres = dj.genre.split(',').map((g) => g.trim()).filter(Boolean);

              const tracks = top10ByDj.get(dj.id) ?? [];

              return (
                <div key={dj.id} className="group flex flex-col gap-2">
                  {/* Image card — all info inside the overlay */}
                  <Link
                    to={`/djs/${dj.id}`}
                    className="relative block rounded-2xl overflow-hidden border border-white/[0.08] hover:border-orange-400/30 transition-all duration-300"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img
                        src={dj.profilePictureUrl || dj.coverImageUrl || defaultDjImage}
                        alt={dj.stageName}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      {/* Gradient: heavy at bottom for text legibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                      {/* Follow button — top right */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFollowToggle(dj, isFollowing);
                        }}
                        disabled={followMutationLoading || unfollowMutationLoading || followLoading}
                        className={`absolute top-3 right-3 px-3.5 py-1.5 rounded-full text-[0.65rem] font-bold tracking-wide transition-all duration-300 ${
                          isFollowing
                            ? 'bg-white/20 backdrop-blur-md text-white border border-white/20 hover:bg-white/30'
                            : 'bg-orange-500/90 backdrop-blur-md text-white hover:bg-orange-400'
                        } disabled:opacity-50`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>

                      {/* Rating badge — top left */}
                      {dj.reviewCount > 0 && (
                        <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-orange-400/30">
                          <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                          <span className="text-[0.65rem] font-bold text-orange-300">{dj.averageRating}</span>
                        </div>
                      )}

                      {/* Bottom overlay — name / city / followers / genres */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
                        <h3 className="text-xl font-black text-white leading-tight group-hover:text-orange-300 transition-colors">
                          {dj.stageName}
                        </h3>
                        <p className="text-[0.65rem] text-white/50 uppercase tracking-wider">Oslo, NO</p>
                        <p className="text-[0.7rem] text-white/60">
                          <span className="font-semibold text-white/80">{dj.followerCount}</span>
                          {' '}followers
                        </p>
                        {genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {genres.slice(0, 3).map((genre) => (
                              <span
                                key={genre}
                                className="px-2 py-0.5 rounded-full text-[0.55rem] font-semibold uppercase tracking-wider text-orange-300/90 bg-orange-400/15 border border-orange-400/20"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Highlights auto-scroll */}
                  <DJHighlights dj={dj} />

                  {/* Song ticker */}
                  {tracks.length > 0 && <SongTicker tracks={tracks} />}

                  {/* Next upcoming event */}
                  {(() => {
                    const now = new Date();
                    const next = (dj.upcomingEvents ?? [])
                      .filter((e) => new Date(e.date) >= now)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                    if (!next) return null;
                    return (
                      <Link
                        to={`/events/${next.eventId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-orange-500/[0.07] border border-orange-400/20 hover:border-orange-400/50 transition group/ev"
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.6rem] uppercase tracking-wider text-orange-400/70 leading-none">Next Set</p>
                          <p className="text-[0.68rem] text-white/80 truncate mt-0.5">{next.title}</p>
                          <p className="text-[0.58rem] text-gray-500 truncate">
                            {new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · '}{next.venueName}{next.city ? `, ${next.city}` : ''}
                          </p>
                        </div>
                      </Link>
                    );
                  })()}

                  {/* View Profile button */}
                  <Link
                    to={`/djs/${dj.id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:border-orange-400/30 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    <span className="text-xs font-semibold text-gray-400 group-hover:text-gray-300 transition-colors">
                      View Profile
                    </span>
                    <span className="text-xs font-bold text-orange-400 group-hover:translate-x-0.5 transition-transform duration-300">&rarr;</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* DJ Application Form Modal */}
      <DJApplicationForm
        isOpen={isApplicationFormOpen}
        onClose={() => setIsApplicationFormOpen(false)}
        onSuccess={() => {
          setApplicationSuccess(true);
          refetchApplication();
          setTimeout(() => setApplicationSuccess(false), 5000);
        }}
      />
    </div>
  );
};

export default DJsPage;
