import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { FOLLOW_DJ, GET_DJ_BY_ID, GET_DJ_TOP10_LISTS, IS_FOLLOWING_DJ, UNFOLLOW_DJ, GET_DJ_REVIEWS, CREATE_DJ_REVIEW } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import { Star, Send, Instagram, Youtube, Facebook, CalendarDays } from 'lucide-react';

const SoundCloudIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.194-1.308-.194-1.332c-.014-.057-.047-.094-.104-.094m1.81-.78c-.067 0-.12.054-.127.116l-.217 2.09.217 2.063c.007.065.06.116.127.116.066 0 .12-.05.126-.116l.241-2.063-.241-2.09c-.006-.062-.06-.116-.126-.116m.891-.278c-.074 0-.133.062-.14.138l-.202 2.368.202 2.087c.007.074.066.135.14.135.076 0 .135-.061.14-.135l.228-2.087-.228-2.368c-.005-.076-.064-.138-.14-.138m.904-.118c-.08 0-.143.068-.148.15l-.19 2.486.19 2.075c.005.08.068.148.148.148.08 0 .142-.068.15-.148l.213-2.075-.214-2.486c-.008-.082-.07-.15-.15-.15m.89.044c-.09 0-.158.074-.163.163l-.178 2.442.178 2.058c.005.09.074.161.164.161.088 0 .157-.072.163-.161l.2-2.058-.2-2.442c-.006-.09-.075-.163-.163-.163m.908-.18c-.094 0-.17.08-.176.176l-.165 2.622.165 2.04c.006.094.082.174.176.174s.17-.08.177-.174l.186-2.04-.186-2.622c-.007-.096-.083-.176-.177-.176m.926-.2c-.104 0-.184.088-.19.192l-.151 2.822.151 2.018c.006.103.086.19.19.19.103 0 .184-.087.19-.19l.17-2.018-.17-2.822c-.006-.104-.087-.192-.19-.192m.94-.12c-.107 0-.194.094-.2.206l-.14 2.942.14 1.993c.006.11.093.202.2.202.11 0 .197-.09.204-.202l.155-1.993-.156-2.942c-.006-.112-.093-.206-.203-.206m2.852-1.578c-.106 0-.19.088-.196.197l-.14 4.52.14 1.96c.006.107.09.195.197.195.108 0 .192-.088.197-.195l.16-1.96-.16-4.52c-.005-.11-.09-.197-.198-.197m-1.907 1.15c-.116 0-.206.1-.212.218l-.127 3.37.127 1.975c.006.116.096.215.212.215.117 0 .207-.1.212-.215l.144-1.975-.144-3.37c-.005-.12-.095-.218-.212-.218m.945-.304c-.12 0-.22.108-.224.232l-.118 3.674.118 1.964c.005.122.103.228.224.228.12 0 .218-.106.224-.228l.132-1.964-.132-3.674c-.006-.124-.104-.232-.224-.232m3.753-.897c-.065 0-.127.017-.182.05-.093-.608-.513-1.087-1.065-1.27-.145-.048-.3-.073-.459-.073-1.047 0-4.757 0-4.757 0-.12.005-.215.103-.215.225v7.94c0 .126.1.228.224.232h6.454c1.16 0 2.1-.94 2.1-2.1 0-1.16-.94-2.1-2.1-2.1"/>
  </svg>
);

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const TwitterXIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
  </svg>
);

const ProfileHighlights = ({ dj }: { dj: { specialties?: string; achievements?: string; yearsExperience?: number; influencedBy?: string } }) => {
  const [index, setIndex] = useState(0);
  const highlights = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (dj.specialties) items.push({ label: 'Specialties', value: dj.specialties });
    if (dj.achievements) items.push({ label: 'Achievements', value: dj.achievements });
    if (dj.yearsExperience) items.push({ label: 'Experience', value: `${dj.yearsExperience} years active` });
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
    <div>
      <div
        key={`${current.label}-${index}`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-400/15 animate-fade-in"
      >
        <span className="text-[0.5rem] uppercase tracking-wider text-orange-400/80 font-bold whitespace-nowrap flex-shrink-0">
          {current.label}
        </span>
        <span className="text-[0.65rem] text-gray-300 truncate">{current.value}</span>
      </div>
      {highlights.length > 1 && (
        <div className="flex gap-1 mt-1.5">
          {highlights.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-2.5 bg-orange-400' : 'w-1 bg-white/15'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

type EventSummary = {
  eventId: string;
  title: string;
  date: string;
  venueName: string;
  city?: string;
  price: number;
  imageUrl?: string;
};

type SocialLink = {
  label: string;
  url: string;
};

type Song = {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  duration: number;
  coverImageUrl?: string;
  audioPreviewUrl?: string;
  spotifyUrl?: string;
  soundCloudUrl?: string;
};

type Top10Entry = {
  id: string;
  djId: string;
  songId: string;
  songTitle: string;
  song?: Song;
};

type DJProfile = {
  id: string;
  name: string;
  stageName: string;
  bio: string;
  longBio?: string;
  genre: string;
  profilePictureUrl?: string;
  coverImageUrl?: string;
  tagline?: string;
  specialties?: string;
  achievements?: string;
  yearsExperience?: number;
  influencedBy?: string;
  equipmentUsed?: string;
  topTracks: string[];
  followerCount: number;
  upcomingEvents: EventSummary[];
  socialLinks: SocialLink[];
};

const DJProfilePage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { siteSettings } = useSiteSettings();

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

  const { data, loading, error } = useQuery(GET_DJ_BY_ID, {
    variables: { id },
    skip: !id,
  });

  const { data: top10Data } = useQuery(GET_DJ_TOP10_LISTS);

  const {
    data: followStatus,
    refetch: refetchFollowStatus,
    loading: followStatusLoading,
  } = useQuery(IS_FOLLOWING_DJ, {
    variables: { userId: resolvedUserId, djId: id },
    skip: !(id && resolvedUserId),
  });

  const [followDj, { loading: followLoading }] = useMutation(FOLLOW_DJ);
  const [unfollowDj, { loading: unfollowLoading }] = useMutation(UNFOLLOW_DJ);

  // Reviews
  const { data: reviewsData, refetch: refetchReviews } = useQuery(GET_DJ_REVIEWS, {
    variables: { djId: id },
    skip: !id,
  });
  const [createReview, { loading: submittingReview }] = useMutation(CREATE_DJ_REVIEW);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reviews = reviewsData?.djReviews ?? [];
  const averageRating = reviews.length > 0
    ? Math.round(reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length * 10) / 10
    : 0;

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      setReviewStatus({ type: 'error', message: 'Please select a rating' });
      return;
    }
    try {
      await createReview({
        variables: {
          input: {
            djId: id,
            rating: reviewRating,
            comment: reviewComment.trim() || null,
          },
        },
      });
      setReviewRating(0);
      setReviewComment('');
      setReviewStatus({ type: 'success', message: 'Review submitted!' });
      refetchReviews();
      setTimeout(() => setReviewStatus(null), 3000);
    } catch (err: any) {
      setReviewStatus({ type: 'error', message: err.message || 'Failed to submit review' });
    }
  };

  const dj: DJProfile | undefined = data?.dj;
  const isFollowing = Boolean(followStatus?.isFollowingDj);

  // Get Top 10 tracks for this DJ from the relationship
  const myTop10 = top10Data?.djTop10Lists?.find((list: any) => list.djId === id);
  const top10Tracks: Top10Entry[] = myTop10?.top10Songs || [];

  const handleFollowClick = async () => {
    if (!dj || !id || !resolvedUserId) return;
    if (!isAuthenticated) {
      alert('Following as guest. Create an account later to sync your lineup.');
    }

    const variables = { input: { userId: resolvedUserId, djId: id } };
    if (isFollowing) {
      await unfollowDj({ variables });
    } else {
      await followDj({ variables });
    }
    await refetchFollowStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error || !dj) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center space-y-3 px-6">
        <p className="text-orange-400 text-lg">Unable to load DJ profile</p>
        <p className="text-gray-500 text-sm">{error?.message ?? 'Profile not found'}</p>
      </div>
    );
  }

  const heroBackground = dj.coverImageUrl ?? siteSettings.defaultDjImageUrl ?? '/media/defaults/dj.svg';
  const defaultEventImage = siteSettings.defaultEventImageUrl ?? '/media/defaults/event.svg';
  const genreTags = (dj.genre ?? '')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);
  const creativeTiles = [
    { label: 'Specialties', value: dj.specialties },
    { label: 'Achievements', value: dj.achievements },
    { label: 'Influences', value: dj.influencedBy },
    { label: 'Equipment', value: dj.equipmentUsed },
  ].filter((tile) => Boolean(tile.value));
  const socialEntries = dj.socialLinks?.filter((link) => Boolean(link.url)) ?? [];
  const now = new Date();
  const upcomingSets = [...dj.upcomingEvents]
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastSets = [...dj.upcomingEvents]
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const djJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: dj.stageName || dj.name,
    description: dj.bio ?? '',
    image: dj.profilePictureUrl ?? heroBackground,
    url: `https://klubn.no/djs/${dj.id}`,
    jobTitle: 'DJ',
    knowsAbout: genreTags,
    ...(socialEntries.length > 0 && {
      sameAs: socialEntries.map((s) => s.url),
    }),
  };

  return (
    <div className="text-white min-h-screen">
      <PageSeo
        title={`${dj.stageName || dj.name} — DJ Profile`}
        description={dj.bio ? `${dj.bio.slice(0, 155)}` : `${dj.stageName || dj.name} is a DJ on KlubN. ${genreTags.join(', ')}.`}
        canonical={`/djs/${dj.id}`}
        image={dj.profilePictureUrl ?? heroBackground}
        type="profile"
        jsonLd={djJsonLd}
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBackground} alt={dj.stageName} className="h-[540px] w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/90 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,107,53,0.20),transparent_50%)] mix-blend-screen" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,rgba(93,23,37,0.25),transparent_50%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_260px] gap-10 items-center">
            {/* Left rail */}
            <div className="space-y-8 border-l border-white/10 pl-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.6em] text-orange-300">Featured DJ</p>
                <h1 className="font-display text-5xl font-black leading-tight tracking-tight">{dj.stageName}</h1>
                {dj.tagline && <p className="text-lg text-gray-300">{dj.tagline}</p>}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{dj.bio}</p>
              <div className="flex flex-wrap gap-2">
                {genreTags.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem] uppercase tracking-[0.35em] text-gray-200"
                  >
                    {genre}
                  </span>
                ))}
                {genreTags.length === 0 && (
                  <span className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem] uppercase tracking-[0.35em] text-gray-200">
                    genre blend
                  </span>
                )}
              </div>
              <ProfileHighlights dj={dj} />
              <div className="text-sm space-y-2">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-gray-500">Followers</p>
                    <p className="text-3xl font-semibold text-white">{dj.followerCount.toLocaleString()}</p>
                  </div>
                  {dj.yearsExperience && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.5em] text-gray-500">Years Active</p>
                      <p className="text-3xl font-semibold text-white">{dj.yearsExperience}</p>
                    </div>
                  )}
                </div>
                {dj.specialties && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-gray-500">Specialties</p>
                    <p className="text-gray-200">{dj.specialties}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Center hero portrait */}
            <div className="relative">
              <div className="absolute -left-12 -right-12 -top-6 -bottom-6 bg-gradient-to-b from-white/10 to-transparent opacity-40 blur-[120px]" />
              <div className="relative h-[460px] rounded-[60px] border border-white/10 overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />
                <img
                  src={dj.profilePictureUrl ?? heroBackground}
                  alt={dj.stageName}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>

            {/* Right rail */}
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleFollowClick}
                disabled={followLoading || unfollowLoading || followStatusLoading}
                className={`w-full px-8 py-3 rounded-full text-xs font-semibold tracking-[0.3em] uppercase transition-all ${
                  isFollowing
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] hover:scale-105'
                } disabled:opacity-60`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              {upcomingSets.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.6rem] uppercase tracking-[0.5em] text-gray-500">Upcoming Sets</p>
                  {upcomingSets.slice(0, 3).map((event) => (
                    <Link
                      key={event.eventId}
                      to={`/events/${event.eventId}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 hover:border-orange-400/40 hover:bg-white/10 transition group"
                    >
                      <img
                        src={event.imageUrl ?? defaultEventImage}
                        alt={event.title}
                        className="h-10 w-10 rounded-xl object-cover border border-white/10 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-orange-300 transition-colors">{event.title}</p>
                        <p className="text-[0.6rem] text-gray-500 truncate">
                          <CalendarDays className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' · '}{event.venueName}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {upcomingSets.length > 3 && (
                    <Link to="/events" className="block text-center text-[0.6rem] uppercase tracking-[0.4em] text-orange-400/70 hover:text-orange-400 transition pt-1">
                      +{upcomingSets.length - 3} more →
                    </Link>
                  )}
                </div>
              ) : null}
              {socialEntries.length > 0 && (
                <div className="space-y-2 text-sm">
                  {socialEntries.map((entry) => {
                    const lbl = entry.label?.toLowerCase() ?? '';
                    const platform =
                      lbl === 'instagram'  ? { Icon: Instagram,    color: 'text-pink-400',   border: 'hover:border-pink-400/60',   bg: 'hover:bg-pink-500/10'   } :
                      lbl === 'youtube'    ? { Icon: Youtube,      color: 'text-red-400',    border: 'hover:border-red-400/60',    bg: 'hover:bg-red-500/10'    } :
                      lbl === 'facebook'   ? { Icon: Facebook,     color: 'text-blue-400',   border: 'hover:border-blue-400/60',   bg: 'hover:bg-blue-500/10'   } :
                      lbl === 'soundcloud' ? { Icon: SoundCloudIcon,color: 'text-orange-400',border: 'hover:border-orange-400/60', bg: 'hover:bg-orange-500/10' } :
                      lbl === 'spotify'    ? { Icon: SpotifyIcon,  color: 'text-green-400',  border: 'hover:border-green-400/60',  bg: 'hover:bg-green-500/10'  } :
                      lbl === 'twitter'    ? { Icon: TwitterXIcon, color: 'text-sky-400',    border: 'hover:border-sky-400/60',    bg: 'hover:bg-sky-500/10'    } :
                                             { Icon: null,         color: 'text-gray-400',   border: 'hover:border-white/30',      bg: 'hover:bg-white/5'       };
                    return (
                      <a
                        key={entry.label}
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-gray-200 transition ${platform.border} ${platform.bg}`}
                      >
                        {platform.Icon && <platform.Icon className={`w-4 h-4 ${platform.color}`} />}
                        <span className="flex-1 font-medium">{entry.label}</span>
                        <span className="text-xs text-gray-500">↗</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20 space-y-16">
        {dj.longBio && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.5em] text-orange-400">Storyline</p>
            <p className="text-gray-200 leading-relaxed whitespace-pre-line">{dj.longBio}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.5em] text-orange-400">Top Tracks</p>
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">
                  {top10Tracks.length.toString().padStart(2, '0')}
                </span>
              </div>
              {top10Tracks.length === 0 ? (
                <p className="text-gray-500">Top 10 list coming soon.</p>
              ) : (
                <div className="space-y-2">
                  {top10Tracks.map((entry, index) => {
                    const song = entry.song;
                    const title = song?.title || entry.songTitle || 'Unknown Track';
                    const artist = song?.artist || 'Unknown Artist';
                    const duration = song?.duration || 0;
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-transparent px-4 py-3 text-sm hover:border-orange-400/30 transition"
                      >
                        <span className="text-xs font-semibold text-orange-300 w-6">{String(index + 1).padStart(2, '0')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{title}</p>
                          <p className="text-xs text-gray-400 truncate">{artist}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {song?.spotifyUrl && (
                            <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 transition" title="Spotify">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                            </a>
                          )}
                          {song?.soundCloudUrl && (
                            <a href={song.soundCloudUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 transition" title="SoundCloud">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.194-1.308-.194-1.332c-.014-.057-.047-.094-.104-.094m1.81-.78c-.067 0-.12.054-.127.116l-.217 2.09.217 2.063c.007.065.06.116.127.116.066 0 .12-.05.126-.116l.241-2.063-.241-2.09c-.006-.062-.06-.116-.126-.116m.891-.278c-.074 0-.133.062-.14.138l-.202 2.368.202 2.087c.007.074.066.135.14.135.076 0 .135-.061.14-.135l.228-2.087-.228-2.368c-.005-.076-.064-.138-.14-.138m.904-.118c-.08 0-.143.068-.148.15l-.19 2.486.19 2.075c.005.08.068.148.148.148.08 0 .142-.068.15-.148l.213-2.075-.214-2.486c-.008-.082-.07-.15-.15-.15m.89.044c-.09 0-.158.074-.163.163l-.178 2.442.178 2.058c.005.09.074.161.164.161.088 0 .157-.072.163-.161l.2-2.058-.2-2.442c-.006-.09-.075-.163-.163-.163m.908-.18c-.094 0-.17.08-.176.176l-.165 2.622.165 2.04c.006.094.082.174.176.174s.17-.08.177-.174l.186-2.04-.186-2.622c-.007-.096-.083-.176-.177-.176m.926-.2c-.104 0-.184.088-.19.192l-.151 2.822.151 2.018c.006.103.086.19.19.19.103 0 .184-.087.19-.19l.17-2.018-.17-2.822c-.006-.104-.087-.192-.19-.192m.94-.12c-.107 0-.194.094-.2.206l-.14 2.942.14 1.993c.006.11.093.202.2.202.11 0 .197-.09.204-.202l.155-1.993-.156-2.942c-.006-.112-.093-.206-.203-.206m2.852-1.578c-.106 0-.19.088-.196.197l-.14 4.52.14 1.96c.006.107.09.195.197.195.108 0 .192-.088.197-.195l.16-1.96-.16-4.52c-.005-.11-.09-.197-.198-.197m-1.907 1.15c-.116 0-.206.1-.212.218l-.127 3.37.127 1.975c.006.116.096.215.212.215.117 0 .207-.1.212-.215l.144-1.975-.144-3.37c-.005-.12-.095-.218-.212-.218m.945-.304c-.12 0-.22.108-.224.232l-.118 3.674.118 1.964c.005.122.103.228.224.228.12 0 .218-.106.224-.228l.132-1.964-.132-3.674c-.006-.124-.104-.232-.224-.232m3.753-.897c-.065 0-.127.017-.182.05-.093-.608-.513-1.087-1.065-1.27-.145-.048-.3-.073-.459-.073-1.047 0-4.757 0-4.757 0-.12.005-.215.103-.215.225v7.94c0 .126.1.228.224.232h6.454c1.16 0 2.1-.94 2.1-2.1 0-1.16-.94-2.1-2.1-2.1"/></svg>
                            </a>
                          )}
                          {duration > 0 && (
                            <span className="text-xs text-gray-500">{minutes}:{String(seconds).padStart(2, '0')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.5em] text-orange-400">Creative DNA</p>
              {creativeTiles.length === 0 ? (
                <p className="text-gray-500 text-sm">More details coming soon.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creativeTiles.map((tile) => (
                    <div
                      key={tile.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 space-y-2"
                    >
                      <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{tile.label}</p>
                      <p>{tile.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews & Ratings Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.5em] text-orange-400">Reviews</p>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= Math.round(averageRating) ? 'fill-orange-400 text-orange-400' : 'text-gray-600'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-orange-300">{averageRating}</span>
                    <span className="text-xs text-gray-500">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}
              </div>

              {/* Submit Review */}
              {isAuthenticated ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <p className="text-sm font-semibold text-gray-300">Rate this DJ</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            star <= (hoverRating || reviewRating)
                              ? 'fill-orange-400 text-orange-400'
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        />
                      </button>
                    ))}
                    {reviewRating > 0 && (
                      <span className="ml-2 text-sm text-orange-300 font-semibold">{reviewRating}/5</span>
                    )}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none text-sm transition"
                  />
                  {reviewStatus && (
                    <p className={`text-sm ${reviewStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {reviewStatus.message}
                    </p>
                  )}
                  <button
                    onClick={handleSubmitReview}
                    disabled={submittingReview || reviewRating === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,107,53,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <p className="text-sm text-gray-400">
                    <Link to="/login" className="text-orange-400 hover:text-orange-300 transition-colors">Sign in</Link>
                    {' '}to leave a review
                  </p>
                </div>
              )}

              {/* Existing Reviews */}
              {reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.slice(0, 10).map((review: any) => (
                    <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{review.userName || 'Anonymous'}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= review.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-600'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-300">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviews.length === 0 && (
                <p className="text-gray-500 text-sm">No reviews yet. Be the first to rate this DJ!</p>
              )}
            </div>
          </div>

          {(() => {
            const EventCard = ({ event, past }: { event: EventSummary; past?: boolean }) => (
              <Link
                key={event.eventId}
                to={`/events/${event.eventId}`}
                className={`flex gap-4 items-center rounded-[20px] border p-4 transition ${
                  past
                    ? 'border-white/5 opacity-60 hover:opacity-80'
                    : 'border-white/10 hover:border-orange-400'
                }`}
              >
                <img
                  src={event.imageUrl ?? defaultEventImage}
                  alt={event.title}
                  className={`h-16 w-16 rounded-[16px] object-cover border border-white/10 ${past ? 'grayscale' : ''}`}
                />
                <div className="flex-1">
                  <p className={`font-semibold ${past ? 'text-gray-400' : 'text-white'}`}>{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString()} · {event.venueName}
                    {event.city ? `, ${event.city}` : ''}
                  </p>
                  {!past && <p className="text-sm text-gray-300">{event.price ? `kr ${event.price}` : 'Free entry'}</p>}
                </div>
              </Link>
            );

            return (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.5em] text-orange-400">Upcoming Sets</p>
                    <Link to="/events" className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-white">
                      View all
                    </Link>
                  </div>
                  {upcomingSets.length === 0 ? (
                    <p className="text-gray-500">No scheduled performances yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {upcomingSets.map((event) => <EventCard key={event.eventId} event={event} />)}
                    </div>
                  )}
                </div>

                {pastSets.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-xs uppercase tracking-[0.5em] text-gray-600">Past Performances</p>
                    <div className="space-y-3">
                      {pastSets.map((event) => <EventCard key={event.eventId} event={event} past />)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </section>
    </div>
  );
};

export default DJProfilePage;
