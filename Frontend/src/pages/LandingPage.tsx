import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_LANDING_DATA, HAS_PENDING_DJ_APPLICATION, GET_DJ_MIXES, GET_GENRES, GET_LANDING_HIGHLIGHTS } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import NewsletterSignup from '../components/common/NewsletterSignup';
import GallerySlideshow from '../components/gallery/GallerySlideshow';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { ScrollReveal } from '../components/effects/ScrollReveal';
import { StaggerContainer, StaggerItem } from '../components/effects/StaggerContainer';
import { TiltCard } from '../components/effects/TiltCard';
import { LineReveal } from '../components/effects/TextReveal';
import { MagneticButton } from '../components/effects/MagneticButton';
import { EqualizerDivider, SoundWaveDivider, MarqueeStrip, BeatPulseLine, VinylSpinner, FrequencySpectrum } from '../components/effects/MusicVisuals';
import { useCountUp } from '../hooks/useCountUp';
import PageSeo from '../components/common/PageSeo';

type ShowcaseItem = {
  label: string;
  title: string;
  copy: string;
  meta?: string;
  href: string;
  image?: string;
};

const HeroSection = ({
  highlight,
  stats,
  showcaseItems,
  siteSettings,
  isAuthenticated,
}: {
  highlight?: any;
  stats: { label: string; value: number }[];
  showcaseItems: ShowcaseItem[];
  isAuthenticated: boolean;
  siteSettings: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroCtaText?: string;
    heroCtaLink?: string;
    heroBackgroundImageUrl?: string;
    heroBackgroundVideoUrl?: string;
    heroOverlayOpacity?: number;
    tagline?: string;
    heroGenres?: string;
    heroLocation?: string;
    heroVibes?: string;
  };
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);
  const hasShowcase = showcaseItems.length > 0;
  const safeIndex = hasShowcase
    ? ((activeShowcaseIndex % showcaseItems.length) + showcaseItems.length) % showcaseItems.length
    : 0;
  const activeShowcase = hasShowcase ? showcaseItems[safeIndex] : undefined;
  const featuredImage =
    highlight?.imageUrl ?? siteSettings.heroBackgroundImageUrl ?? '/media/sections/hero/KlubN12.07 screen (1) copy.png';

  // Don't mount the video element at all until page is fully interactive
  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setShowVideo(true), { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    // Safari doesn't support requestIdleCallback — use setTimeout fallback
    const timer = setTimeout(() => setShowVideo(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasShowcase) {
      return;
    }
    const interval = setInterval(() => {
      setActiveShowcaseIndex((prev) => (prev + 1) % showcaseItems.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [hasShowcase, showcaseItems.length]);

  const setIndex = (next: number) => {
    if (!hasShowcase) return;
    setActiveShowcaseIndex(((next % showcaseItems.length) + showcaseItems.length) % showcaseItems.length);
  };

  return (
    <section className="relative flex min-h-[65vh] lg:min-h-[80vh] w-full max-w-full flex-col justify-center overflow-clip bg-black text-white">
      {/* Background image shown immediately */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${featuredImage})` }}
      />
      {/* Video fades in only after browser is idle */}
      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover animate-fade-in"
          muted
          loop
          playsInline
          autoPlay
          preload="none"
        >
          {[siteSettings.heroBackgroundVideoUrl, '/media/sections/hero/0721-copy.mp4']
            .filter(Boolean)
            .map((src) => (
              <source key={src} src={src as string} type="video/mp4" />
            ))}
        </video>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent"
        style={{ opacity: siteSettings.heroOverlayOpacity ?? 0.95 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_rgba(255,87,34,0.25),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-black/40 to-black" />

      {/* Genre & vibe strip — only shown on large screens to avoid overlap with hero CTA buttons */}
      <div className="hidden lg:block absolute inset-x-0 bottom-0 z-10 pb-7 pointer-events-none">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap pointer-events-auto">
            {(siteSettings.heroGenres || 'Techno, House, Afro House, Minimal, Deep House, Amapiano, Drum & Bass')
              .split(',')
              .map((g: string) => g.trim())
              .filter(Boolean)
              .map((genre: string) => (
              <span
                key={genre}
                className="px-4 py-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] text-xs uppercase tracking-[0.25em] text-gray-300 hover:border-orange-400/30 hover:text-white transition-colors cursor-default"
              >
                {genre}
              </span>
            ))}
            <span className="mx-2 h-4 w-px bg-white/10" />
            <span className="text-xs uppercase tracking-[0.25em] text-orange-400/60 font-medium">{siteSettings.heroLocation || 'Oslo · Every Weekend'}</span>
          </div>
          <div className="flex items-center gap-5 text-[0.7rem] uppercase tracking-[0.3em] text-white/25">
            {(siteSettings.heroVibes || 'Underground culture, Live sets, Late night energy, Sound first')
              .split(',')
              .map((v: string) => v.trim())
              .filter(Boolean)
              .map((vibe: string, i: number) => (
              <span key={vibe} className="contents">
                {i > 0 && <span className="h-1 w-1 rounded-full bg-white/20" />}
                <span>{vibe}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col-reverse gap-8 px-6 pt-12 pb-12 sm:pb-24 lg:flex-row lg:items-center lg:gap-12 lg:px-8 lg:pt-16 lg:pb-28">
        <div className="flex-1 space-y-6">
          <div className="space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.0] tracking-tight">
              {siteSettings.heroTitle ?? (
                <>
                  Your Night.<br />Your Music.<br /><span className="shimmer-text bg-gradient-to-r from-orange-400 via-[#FF6B35] to-orange-500 bg-clip-text text-transparent">Your KlubN.</span>
                </>
              )}
            </h1>
            <p
              className="max-w-xl leading-relaxed bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent"
              style={{ fontFamily: "'Pacifico', cursive", fontSize: '1.3rem', lineHeight: '1.8' }}
            >
              {siteSettings.heroSubtitle ||
                'Book tickets to exclusive DJ events, discover new artists, and be part of the Afrobeats music scene.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-6 py-3 text-sm rounded-full bg-gradient-to-r from-orange-500 via-[#FF6B35] to-orange-600 text-white font-semibold hover:from-orange-400 hover:via-[#FF6B35] hover:to-orange-500 transition-all shadow-lg shadow-orange-600/30 hover:shadow-orange-500/50"
                >
                  Go to Dashboard
                </Link>
                <Link
                  to="/events"
                  className="px-6 py-3 text-sm rounded-full border-2 border-orange-600/60 text-orange-300 font-semibold hover:border-orange-500 hover:bg-orange-600/20 transition-all shadow-lg shadow-orange-600/20"
                >
                  Browse Events
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="px-6 py-3 text-sm rounded-full bg-gradient-to-r from-orange-500 via-[#FF6B35] to-orange-600 text-white font-semibold hover:from-orange-400 hover:via-[#FF6B35] hover:to-orange-500 transition-all shadow-lg shadow-orange-600/30 hover:shadow-orange-500/50"
                >
                  Join the Movement
                </Link>
                <Link
                  to="/events"
                  className="px-6 py-3 text-sm rounded-full border-2 border-orange-600/60 text-orange-300 font-semibold hover:border-orange-500 hover:bg-orange-600/20 transition-all shadow-lg shadow-orange-600/20"
                >
                  Explore Events
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4 lg:max-w-md">
          {activeShowcase ? (
            <>
              <div className="group rounded-xl border border-orange-600/30 bg-gradient-to-br from-zinc-900/80 to-black/90 overflow-hidden hover:border-orange-500/60 transition-all shadow-lg shadow-orange-900/20">
                <Link to={activeShowcase.href} className="relative block h-[280px] sm:h-[360px]">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{
                      backgroundImage: activeShowcase.image ? `url(${activeShowcase.image})` : undefined,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-orange-950/30 to-black/95" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-5">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-400">{activeShowcase.label}</p>
                      <h3 className="text-xl font-bold mt-1 text-white group-hover:text-orange-300 transition-colors">{activeShowcase.title}</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">{activeShowcase.copy}</p>
                      {activeShowcase.meta && (
                        <p className="text-[0.65rem] text-orange-400/60">{activeShowcase.meta}</p>
                      )}
                      <span className="inline-flex items-center gap-2 text-orange-400 text-xs font-semibold group-hover:gap-3 group-hover:text-orange-300 transition-all">
                        Learn More →
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex gap-1.5">
                  {showcaseItems.map((item, idx) => (
                    <button
                      key={`${item.label}-${idx}`}
                      type="button"
                      aria-label={`Show ${item.label}`}
                      onClick={() => setIndex(idx)}
                      className={`h-1 rounded-full transition-all ${
                        idx === safeIndex ? 'w-8 bg-gradient-to-r from-orange-500 to-[#FF6B35]' : 'w-6 bg-white/20 hover:bg-orange-600/40'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <button type="button" onClick={() => setIndex(safeIndex - 1)} className="hover:text-orange-400 transition">
                    Prev
                  </button>
                  <button type="button" onClick={() => setIndex(safeIndex + 1)} className="hover:text-orange-400 transition">
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-orange-600/30 bg-gradient-to-br from-zinc-900/80 to-black/90 overflow-hidden shadow-lg shadow-orange-900/20">
              <div className="relative block h-[280px] sm:h-[360px]">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${featuredImage})` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-orange-950/30 to-black/95" />
                <div className="relative z-10 flex h-full flex-col justify-end space-y-2 p-5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-400">Coming Soon</p>
                  <h3 className="text-xl font-bold">New Events Loading</h3>
                  <p className="text-xs text-gray-300">Stay tuned for upcoming shows and exclusive DJ performances.</p>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 border border-orange-600/30 rounded-xl px-4 py-4 bg-gradient-to-br from-orange-950/20 to-black/60 shadow-lg shadow-orange-900/20">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-br from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">{stat.value}</p>
                <p className="text-[0.6rem] uppercase tracking-wide text-orange-400/70 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CountUpStat = ({ target, label }: { target: number | string; label: string }) => {
  const { value, ref } = useCountUp(target);
  return (
    <div className="text-center space-y-1">
      <p ref={ref as React.RefObject<HTMLParagraphElement>} className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
};

type HighlightMedia = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string | null;
};

type Highlight = {
  id: string;
  title: string;
  blurb?: string | null;
  coverImageUrl: string;
  coverVideoUrl?: string | null;
  highlightDate: string;
  eventId: string;
  eventTitle?: string | null;
  upcomingEventId?: string | null;
  upcomingEventTitle?: string | null;
  media: HighlightMedia[];
};

// Highlights / Previous Moments — horizontal recap carousel of past nights.
// Renders nothing when there are no published highlights.
const HighlightsCarousel = () => {
  const { data } = useQuery(GET_LANDING_HIGHLIGHTS);
  const highlights: Highlight[] = data?.landingHighlights ?? [];

  if (highlights.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-10">
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">Previous Moments</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">
              Relive the{' '}
              <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">Nights.</span>
            </h2>
          </div>
        </div>
      </ScrollReveal>

      <div className="-mx-6 px-6 lg:-mx-8 lg:px-8 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4 pb-2">
          {highlights.map((h, i) => (
            <motion.article
              key={h.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="snap-start shrink-0 w-[85vw] sm:w-[28rem] lg:w-[32rem]"
            >
              <div className="liquid-glass group relative flex h-full flex-col rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="relative aspect-[16/9] overflow-hidden bg-[#0a0a0a]">
                  {h.coverVideoUrl ? (
                    <video
                      src={h.coverVideoUrl}
                      poster={h.coverImageUrl || undefined}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <img
                      src={h.coverImageUrl}
                      alt={h.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md bg-orange-500/20 border border-orange-500/30 text-[0.65rem] font-bold text-orange-300 uppercase tracking-wide">
                    {new Date(h.highlightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white leading-tight">{h.title}</h3>
                    {h.eventTitle && (
                      <p className="text-[0.7rem] uppercase tracking-wide text-gray-400">{h.eventTitle}</p>
                    )}
                  </div>
                  {h.blurb && (
                    <p className="text-sm text-gray-300/80 leading-relaxed line-clamp-3">{h.blurb}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to={`/events/${h.eventId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Relive →
                    </Link>
                    {h.upcomingEventId && (
                      <Link
                        to={`/events/${h.upcomingEventId}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/90 hover:border-orange-400/40 hover:bg-white/[0.10] transition-colors"
                      >
                        Next: {h.upcomingEventTitle ?? 'Upcoming'} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const { data, loading, error } = useQuery(GET_LANDING_DATA);
  const { siteSettings } = useSiteSettings();
  const { isAuthenticated, isDJ, user } = useAuth();
  const events = data?.landing?.events ?? [];
  const djs = data?.landing?.dJs ?? [];

  const { data: pendingAppData } = useQuery(HAS_PENDING_DJ_APPLICATION, {
    variables: { userId: user?.id ?? '' },
    skip: !user || isDJ,
  });
  const { data: mixesData } = useQuery(GET_DJ_MIXES);
  const { data: genresData } = useQuery(GET_GENRES);
  const featuredImageFallback =
    siteSettings.heroBackgroundImageUrl ?? '/media/sections/hero/KlubN12.07 screen (1) copy.png';

  const highlightEvent = events[0];
  const gridEvents = events.slice(1, 5);
  const heroStats = [
    { label: 'Active Shows', value: events.length || 18 },
    { label: 'Resident DJs', value: djs.length || 42 },
    { label: 'Cities Live', value: 12 },
  ];
  const defaultEventImage = siteSettings.defaultEventImageUrl ?? featuredImageFallback;
  const defaultDjImage = siteSettings.defaultDjImageUrl ?? '/media/defaults/dj.svg';
  const featuredDjs = djs.slice(0, 4);
  const galleryPreview = events.slice(0, 5);

  // Read marquee text from localStorage (admin-editable under Content Pages > Visual Effects)
  const marqueeWords = useMemo(() => {
    const stored = localStorage.getItem('cms_marqueeWords');
    return stored ? stored.split(',').map(w => w.trim()).filter(Boolean) : undefined;
  }, []);
  const marqueeGenreWords = useMemo(() => {
    const stored = localStorage.getItem('cms_marqueeGenreWords');
    if (stored) return stored.split(',').map(w => w.trim()).filter(Boolean);
    // Use live genres from DB
    const liveGenres = genresData?.genres as { id: string; name: string }[] | undefined;
    if (liveGenres && liveGenres.length > 0) return liveGenres.map(g => g.name.toUpperCase());
    // Fall back to heroGenres from settings
    const heroGenres = siteSettings.heroGenres;
    if (heroGenres) return heroGenres.split(',').map((g: string) => g.trim().toUpperCase()).filter(Boolean);
    return undefined;
  }, [genresData, siteSettings.heroGenres]);

  const trendingDj = djs[0];
  const heroShowcaseItems = useMemo(() => {
    const items: ShowcaseItem[] = [];
    if (highlightEvent) {
      items.push({
        label: 'Events',
        title: highlightEvent.title,
        copy: highlightEvent.description,
        meta: `${new Date(highlightEvent.date).toLocaleDateString()} · ${highlightEvent.venue?.name ?? 'TBA'}`,
        href: `/events/${highlightEvent.id}`,
        image: highlightEvent.imageUrl ?? featuredImageFallback,
      });
    }
    if (trendingDj) {
      items.push({
        label: 'Featured Artist',
        title: trendingDj.stageName ?? trendingDj.name,
        copy: trendingDj.bio,
        meta: 'Resident DJ · Weekly Performances',
        href: `/djs/${trendingDj.id}`,
        image: trendingDj.profilePictureUrl ?? highlightEvent?.imageUrl ?? featuredImageFallback,
      });
    }
    items.push({
      label: 'Featured Mix',
      title: 'Afterhours Pulse',
      copy: 'A 2AM blend of electro, breaks, and left-field club cuts. Perfect for late-night sessions.',
      meta: 'Curated by KlubN Residents',
      href: '/gallery',
      image: featuredImageFallback,
    });
    const galleryHeadline = galleryPreview.find((item: any) => item?.imageUrl) ?? highlightEvent;
    if (galleryHeadline) {
      items.push({
        label: 'Event Gallery',
        title: galleryHeadline.title ?? 'Latest Moments',
        copy: galleryHeadline.description ?? 'Immersive visuals capturing the energy and atmosphere of our events.',
        meta: 'Professional Event Photography',
        href: galleryHeadline.id ? `/events/${galleryHeadline.id}` : '/gallery',
        image: galleryHeadline.imageUrl ?? featuredImageFallback,
      });
    }
    if (!items.length) {
      items.push({
        label: 'Coming Soon',
        title: 'Stay Tuned',
        copy: 'New events, DJ lineups, and exclusive content coming soon. Check back for updates.',
        href: '/events',
        image: featuredImageFallback,
      });
    }
    return items;
  }, [galleryPreview, highlightEvent, trendingDj]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error) {
    console.error('[LandingPage] GraphQL error:', error.message);
  }

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteSettings.siteName || 'KlubN',
    url: 'https://klubn.no',
    logo: 'https://klubn.no/icons/lets-go-klubn-320.png',
    description: siteSettings.heroSubtitle || 'Oslo\'s home for high-energy club culture.',
    sameAs: [
      siteSettings.instagramUrl,
      siteSettings.facebookUrl,
      siteSettings.youTubeUrl,
      siteSettings.twitterUrl,
    ].filter(Boolean),
  };

  return (
    <div className="relative min-h-screen w-full max-w-full text-white">
      <PageSeo
        title="Lets Go KlubN — Oslo Nightlife, Events & DJs"
        description={siteSettings.heroSubtitle || "KlubN is Oslo's home for high-energy club culture. Discover events, DJs, and the sound that moves the city."}
        canonical="/"
        jsonLd={orgJsonLd}
      />
      <div className="relative">
      <HeroSection
        highlight={highlightEvent}
        stats={heroStats}
        showcaseItems={heroShowcaseItems}
        siteSettings={siteSettings}
        isAuthenticated={isAuthenticated}
      />

      {/* ─── Brand Statement ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          <ScrollReveal className="lg:w-1/2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">{siteSettings.cultureHeading || 'The Culture'}</p>
            <LineReveal>
              <h2 className="text-3xl lg:text-5xl font-bold leading-[1.1]">
                {(() => {
                  const headline = siteSettings.brandHeadline || 'Where Oslo Comes Alive At Night';
                  const words = headline.split(' ');
                  const half = Math.ceil(words.length / 2);
                  return (
                    <>
                      {words.slice(0, half).join(' ')}<br />
                      <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">{words.slice(half).join(' ')}.</span>
                    </>
                  );
                })()}
              </h2>
            </LineReveal>
          </ScrollReveal>
          <ScrollReveal className="lg:w-1/2 lg:pt-14" delay={0.15}>
            <p className="text-base lg:text-lg text-gray-300/80 leading-relaxed max-w-lg">
              {siteSettings.brandNarrative || "KlubN is Oslo's home for high-energy club culture — Afrobeat, Hip Hop, Shatta, Amapiano, and more. Featuring the best local and international DJs, we create nights that set the standard and introduce the next wave in Oslo nightlife."}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Marquee ─── */}
      <MarqueeStrip words={marqueeWords} variant="mixed" speed={28} />

      {/* ─── Events Section ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20 space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">{siteSettings.eventsHeading || "What's Coming"}</p>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Upcoming Events</h2>
            </div>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 text-sm text-orange-400 font-semibold hover:text-orange-300 transition-colors whitespace-nowrap"
            >
              See All Events →
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-[38%_1fr] gap-4">
          {/* ── Featured Poster ── */}
          <ScrollReveal direction="left">
            {highlightEvent ? (
              <TiltCard intensity={5} className="h-full">
                <Link
                  to={`/events/${highlightEvent.id}`}
                  className="group relative flex h-full min-h-[480px] sm:min-h-[560px] rounded-3xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/10 hover:ring-orange-400/50 transition-all duration-500"
                >
                  {/* Blurred ambient backdrop — fills dead space */}
                  <div
                    className="absolute inset-0 scale-110 blur-2xl brightness-50 saturate-150"
                    style={{ backgroundImage: `url(${highlightEvent.imageUrl ?? defaultEventImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

                  {/* Crisp centred poster */}
                  <img
                    src={highlightEvent.imageUrl ?? defaultEventImage}
                    alt={highlightEvent.title}
                    className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.04] transition-transform duration-700 drop-shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
                  />

                  {/* Headliner badge */}
                  <span className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white text-[0.6rem] font-bold uppercase tracking-widest shadow-lg shadow-orange-600/50">
                    Headliner
                  </span>

                  {/* Info overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent pt-20 pb-6 px-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-orange-500/20 border border-orange-500/30 text-[0.65rem] font-bold text-orange-300 uppercase tracking-wide">
                          {new Date(highlightEvent.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {highlightEvent.venue?.name && (
                          <span className="text-[0.65rem] text-gray-400 uppercase tracking-wide truncate">
                            {highlightEvent.venue.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-black text-white leading-tight group-hover:text-orange-200 transition-colors">
                        {highlightEvent.title}
                      </h3>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-xl font-black bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">
                          kr {highlightEvent.price}
                        </p>
                        <span className="px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-orange-600/40 group-hover:scale-105 transition-transform">
                          Get Tickets →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </TiltCard>
            ) : (
              <div className="relative h-full min-h-[480px] rounded-3xl overflow-hidden ring-1 ring-white/10 bg-[#0a0a0a] flex items-center justify-center">
                <p className="text-orange-400/20 text-sm font-medium uppercase tracking-widest">Coming Soon</p>
              </div>
            )}
          </ScrollReveal>

          {/* ── 2×2 Grid ── */}
          <StaggerContainer className="grid grid-cols-2 gap-3">
            {(gridEvents.length > 0 ? gridEvents : ['', '', '', ''] as any[]).map((event: any, i: number) => (
              <StaggerItem key={event?.id ?? i}>
                <TiltCard intensity={10}>
                  {event?.id ? (
                    <Link
                      to={`/events/${event.id}`}
                      className="group relative block rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/10 hover:ring-orange-400/50 transition-all duration-300"
                    >
                      {/* Blurred ambient backdrop */}
                      <div
                        className="absolute inset-0 scale-110 blur-xl brightness-50 saturate-150"
                        style={{ backgroundImage: `url(${event.imageUrl ?? defaultEventImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      {/* Poster */}
                      <img
                        src={event.imageUrl ?? defaultEventImage}
                        alt={event.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.05] group-hover:brightness-110 transition-all duration-500 drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                      />

                      {/* Date badge */}
                      <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-md bg-orange-500 text-white text-[0.65rem] font-bold uppercase tracking-wide shadow-md">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>

                      {/* Genre */}
                      {event.genres?.[0] && (
                        <div className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-[0.6rem] text-gray-300 uppercase tracking-wide backdrop-blur-sm">
                          {event.genres[0]}
                        </div>
                      )}

                      {/* Info */}
                      <div className="absolute inset-x-0 bottom-0 z-10 p-3.5 space-y-1">
                        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-xs text-gray-400 truncate">{event.venue?.name ?? 'TBA'}</p>
                        <p className="text-sm font-black bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">
                          kr {event.price}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="relative block rounded-2xl overflow-hidden aspect-[3/4] bg-white/[0.03] ring-1 ring-white/5 flex items-center justify-center">
                      <p className="text-orange-400/20 text-[0.6rem] uppercase tracking-widest">Coming Soon</p>
                    </div>
                  )}
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ─── Wave Divider ─── */}
      <SoundWaveDivider theme="orange" />

      {/* ─── The Craft / Portfolio ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          <ScrollReveal className="lg:w-1/2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">{siteSettings.conceptHeading || 'The Concept'}</p>
            <LineReveal>
              <h2 className="text-3xl lg:text-5xl font-bold leading-[1.1]">
                Unmatched Club<br />
                <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">Concepts.</span>
              </h2>
            </LineReveal>
          </ScrollReveal>
          <ScrollReveal className="lg:w-1/2 lg:pt-14 space-y-6" delay={0.15}>
            <p className="text-base lg:text-lg text-gray-300/80 leading-relaxed max-w-lg">
              Every KlubN night is a curated experience — themed concepts,
              handpicked lineups, and production that raises the bar. We bring
              together Oslo's finest and international talent to deliver nights
              you won't find anywhere else in the city.
            </p>
            <div className="flex flex-wrap gap-3">
              <MagneticButton>
                <Link to="/gallery" className="btn-brand text-xs">
                  View Portfolio
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link to="/playlists" className="btn-outline text-xs">
                  Listen Now
                </Link>
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <ScrollReveal>
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <TiltCard intensity={4}>
        <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <CountUpStat target={events.length || 24} label="Active Events" />
            <CountUpStat target={djs.length || 42} label="Featured DJs" />
            <CountUpStat target={12} label="Cities" />
            <CountUpStat target="24/7" label="Support" />
          </div>
        </div>
        </TiltCard>
      </section>
      </ScrollReveal>

      {/* ─── Frequency Spectrum ─── */}
      <FrequencySpectrum theme="gradient" intensity="low" />

      {/* ─── Highlights / Previous Moments ─── */}
      <HighlightsCarousel />

      {/* ─── Featured DJs Intro ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          <ScrollReveal className="lg:w-1/2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">{siteSettings.lineupHeading || 'The Lineup'}</p>
            <LineReveal>
              <h2 className="text-3xl lg:text-5xl font-bold leading-[1.1]">
                Oslo's Best.<br />
                <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">World-Class Guests.</span>
              </h2>
            </LineReveal>
          </ScrollReveal>
          <ScrollReveal className="lg:w-1/2 lg:pt-14" delay={0.15}>
            <p className="text-base lg:text-lg text-gray-300/80 leading-relaxed max-w-lg">
              From Oslo-based residents to international headliners — our DJs
              bring the genres that move the city. Discover who's spinning next.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Featured DJs Grid ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-16">
        <div className="flex items-end justify-between mb-8">
          <div />
          <Link
            to="/djs"
            className="inline-flex items-center gap-2 text-sm text-orange-400 font-semibold hover:text-orange-300 transition-colors"
          >
            View All Artists →
          </Link>
        </div>

        {featuredDjs.length > 0 ? (
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.12}>
            {featuredDjs.map((dj: any) => (
              <StaggerItem key={dj.id}>
              <TiltCard intensity={10}>
              <Link
                to={`/djs/${dj.id}`}
                className="liquid-glass group block rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden hover:from-white/[0.16] hover:to-white/[0.05] hover:border-white/[0.18] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),_0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300"
              >
                <div className="flex flex-col">
                  <div className="relative overflow-hidden h-60">
                    <img
                      src={dj.profilePictureUrl ?? dj.coverImageUrl ?? defaultDjImage}
                      alt={dj.stageName ?? dj.name}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>

                  <div className="px-4 py-3 space-y-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                      {dj.stageName ?? dj.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] text-gray-400">Oslo, NO</span>
                      <div className="flex items-center gap-1">
                        <span className="text-orange-400 text-[0.6rem]">&#9733;</span>
                        <span className="text-[0.6rem] text-gray-300 font-medium">{dj.followerCount ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(dj.genre ?? '')
                        .split(',')
                        .slice(0, 2)
                        .map((genre: string) => (
                          <span
                            key={`${dj.id}-${genre.trim()}`}
                            className="px-2 py-0.5 rounded-full text-[0.6rem] font-medium bg-gradient-to-b from-white/[0.08] to-white/[0.03] text-gray-300 border border-white/[0.05]"
                          >
                            {genre.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </Link>
              </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.12}>
            {[
              { name: 'DJ Phantom', genre: 'Afrobeats', bio: 'Dark, driving Afrobeats sets that push the boundaries of the genre.' },
              { name: 'Luna Bass', genre: 'House', bio: 'Deep house grooves with soulful vocals and hypnotic basslines.' },
              { name: 'Neon Pulse', genre: 'Electro', bio: 'High-energy electro and breaks, blending analog synths with digital precision.' },
              { name: 'Echo Chamber', genre: 'Ambient', bio: 'Atmospheric soundscapes and downtempo beats for late-night listening.' },
            ].map((placeholder) => (
              <StaggerItem key={placeholder.name}>
              <div
                className="liquid-glass rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),_0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
              >
                <div className="flex flex-col h-[320px]">
                  <div className="relative overflow-hidden h-40 bg-white/[0.02] flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                      <span className="text-gray-600 text-2xl font-bold">{placeholder.name[0]}</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div className="space-y-2">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-400/50">Artist</p>
                        <h3 className="text-sm font-bold text-white/80 mt-1">{placeholder.name}</h3>
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed">{placeholder.bio}</p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[0.6rem] font-medium bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-gray-500 border border-white/[0.04]">
                        {placeholder.genre}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </section>

      {/* ─── Are You a DJ? (logged-in non-DJ users only) ─── */}
      {isAuthenticated && !isDJ && (
        <ScrollReveal>
          <section className="max-w-5xl mx-auto px-6 lg:px-8 py-16">
            <div className="relative rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-950/30 via-[#5D1725]/20 to-black overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,107,53,0.15),_transparent_60%)]" />
              <div className="relative px-8 py-12 md:px-12 md:py-16 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.5em] text-orange-400">For DJs</p>
                  <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight">
                    Are You a DJ?
                  </h2>
                  {pendingAppData?.hasPendingDjApplication ? (
                    <>
                      <p className="text-gray-400 text-lg max-w-lg">
                        Your application is currently under review. Our team will get back to you soon.
                      </p>
                      <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-semibold">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Application Under Review
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400 text-lg max-w-lg">
                        Join the lineup and showcase your talent. Get featured on the platform, connect with venues, and grow your audience.
                      </p>
                      <Link
                        to="/dj-enroll"
                        className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-bold text-sm tracking-wide hover:shadow-[0_0_40px_rgba(255,107,53,0.5)] hover:scale-105 transition-all"
                      >
                        Apply Now
                      </Link>
                    </>
                  )}
                </div>
                <div className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-orange-500/20 to-[#5D1725]/20 border border-orange-500/10 flex items-center justify-center">
                  <svg className="w-16 h-16 md:w-20 md:h-20 text-orange-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ─── Beat Pulse ─── */}
      <BeatPulseLine theme="orange" />

      {/* ─── Testimonial ─── */}
      <ScrollReveal>
      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-12">
        <TiltCard intensity={5}>
        <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] p-10 text-center space-y-5">
          <p className="text-xl md:text-2xl font-medium text-white max-w-2xl mx-auto leading-relaxed">
            "Every night is a new experience. From intimate basement sets to main stage moments — this is where music comes alive."
          </p>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-orange-400">The KlubN Experience</p>
            <p className="text-[0.65rem] text-gray-500">Join thousands of music lovers</p>
          </div>
        </div>
        </TiltCard>
      </section>
      </ScrollReveal>

      {/* ─── Gallery Intro ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          <ScrollReveal className="lg:w-1/2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">The Experience</p>
            <LineReveal>
              <h2 className="text-3xl lg:text-5xl font-bold leading-[1.1]">
                Feel The<br />
                <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">Energy.</span>
              </h2>
            </LineReveal>
          </ScrollReveal>
          <ScrollReveal className="lg:w-1/2 lg:pt-14" delay={0.15}>
            <p className="text-base lg:text-lg text-gray-300/80 leading-relaxed max-w-lg">
              The lights, the crowd, the bass — KlubN nights hit different.
              See what happens when Oslo's nightlife community comes together.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Gallery ─── */}
      <ScrollReveal>
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-16">
        <GallerySlideshow />
      </section>
      </ScrollReveal>

      {/* ─── Vinyl + Equalizer Divider ─── */}
      <div className="relative w-full py-6 md:py-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <div className="max-w-5xl mx-auto px-6 lg:px-8 flex items-center gap-4 sm:gap-6">
          <div className="flex-1"><EqualizerDivider theme="magenta" intensity="low" /></div>
          <VinylSpinner size={64} theme="magenta" />
          <div className="flex-1"><EqualizerDivider theme="magenta" intensity="low" /></div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ─── Mixes & Sets ─── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24 space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          <ScrollReveal className="lg:w-1/2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">Listen Now</p>
            <LineReveal>
              <h2 className="text-3xl lg:text-5xl font-bold leading-[1.1]">
                Mixes &<br />
                <span className="shimmer-text bg-gradient-to-r from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">Sets</span>
              </h2>
            </LineReveal>
          </ScrollReveal>
          <ScrollReveal className="lg:w-1/2 lg:pt-14" delay={0.15}>
            <p className="text-base lg:text-lg text-gray-300/80 leading-relaxed max-w-lg">
              Stream sets from our resident and guest DJs. Afrobeat, Amapiano,
              Shatta, Hip Hop — the sounds that define KlubN nights, available
              anytime.
            </p>
          </ScrollReveal>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(mixesData?.djMixes ?? []).slice(0, 3).map((mix: any) => (
            <StaggerItem key={mix.id}>
            <TiltCard intensity={8}>
            <a
              href={mix.mixUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-glass group block rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden hover:from-white/[0.16] hover:to-white/[0.05] hover:border-white/[0.18] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),_0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300"
            >
              <div className="flex flex-col h-[300px]">
                <div className="relative overflow-hidden h-32">
                  <div
                    className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                    style={{ backgroundImage: `url(${mix.thumbnailUrl || featuredImageFallback})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {mix.genre && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-wide bg-gradient-to-b from-white/[0.12] to-white/[0.04] text-white/80 border border-white/[0.06]">
                      {mix.genre}
                    </span>
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    {mix.mixType && (
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-400/80">{mix.mixType}</p>
                    )}
                    <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                      {mix.title}
                    </h3>
                    {mix.description && (
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                        {mix.description}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-2 text-orange-400 text-xs font-semibold group-hover:gap-3 transition-all">
                    Listen Now →
                  </span>
                </div>
              </div>
            </a>
            </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ─── Marquee 2 ─── */}
      <MarqueeStrip
        words={marqueeGenreWords || ['AFROBEAT', 'AMAPIANO', 'HIP HOP', 'SHATTA', 'DANCEHALL', 'HOUSE', 'TECHNO', 'R&B']}
        speed={35}
        variant="outlined"
      />

      {/* ─── Social ─── */}
      <ScrollReveal>
      <section className="max-w-4xl mx-auto px-6 lg:px-8 py-16 text-center space-y-8">
        <div className="space-y-3">
          <p className="text-eyebrow text-orange-400">Follow the Movement</p>
          <h2 className="text-2xl lg:text-3xl font-bold">Stay Connected</h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Catch behind-the-scenes moments, event announcements, and exclusive drops across our channels.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {[
            { label: 'Instagram', icon: 'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', url: siteSettings.instagramUrl },
            { label: 'TikTok', icon: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z', url: siteSettings.tikTokUrl },
            { label: 'YouTube', icon: 'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z', url: siteSettings.youTubeUrl },
            { label: 'Twitter', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z', url: siteSettings.twitterUrl },
            { label: 'SoundCloud', icon: 'M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m1.2-.8c-.064 0-.11.05-.119.114l-.209 2.953.209 2.88c.009.06.055.108.12.108.063 0 .11-.048.12-.108l.236-2.88-.236-2.954c-.011-.063-.058-.113-.12-.113m1.223-.27c-.074 0-.127.058-.135.127l-.186 3.223.186 3.1c.008.07.06.124.135.124.073 0 .126-.054.134-.124l.21-3.1-.21-3.223c-.009-.069-.061-.127-.134-.127m1.273.156c-.088 0-.145.066-.152.143l-.163 2.893.163 3.05c.007.078.064.14.152.14.086 0 .144-.063.152-.14l.184-3.05-.184-2.893c-.008-.077-.066-.143-.152-.143m1.248-.55c-.099 0-.165.076-.172.16l-.14 3.287.14 3.024c.007.087.073.157.172.157.097 0 .163-.07.171-.157l.16-3.024-.16-3.286c-.008-.085-.074-.161-.171-.161m1.3.228c-.11 0-.182.085-.19.177l-.117 3.06.117 2.997c.008.095.08.172.19.172.108 0 .18-.077.189-.172l.132-2.997-.132-3.06c-.009-.092-.08-.177-.189-.177m1.318-.34c-.127 0-.2.095-.208.196l-.093 3.168.093 2.97c.007.105.08.19.208.19.12 0 .198-.085.207-.19l.107-2.97-.107-3.168c-.009-.1-.087-.196-.207-.196m3.488-1.14c-.16 0-.27.12-.28.254l-.05 4.03.05 2.878c.008.13.12.234.28.234.155 0 .27-.104.278-.234l.057-2.878-.057-4.03c-.008-.134-.123-.254-.278-.254m1.295.108c-.165 0-.283.127-.29.267l-.035 3.909.035 2.86c.007.14.125.25.29.25.163 0 .28-.11.29-.25l.04-2.86-.04-3.91c-.01-.14-.127-.266-.29-.266m-2.607-.024c-.14 0-.244.11-.253.233l-.065 3.942.065 2.904c.008.12.112.22.253.22.138 0 .24-.1.25-.22l.074-2.904-.074-3.942c-.01-.123-.112-.233-.25-.233m3.953-.544c-.178 0-.305.135-.312.29l-.02 4.435.02 2.832c.007.152.134.276.312.276.174 0 .303-.124.31-.276l.023-2.832-.023-4.435c-.007-.155-.136-.29-.31-.29m1.322.14c-.19 0-.32.142-.328.303v.013l-.006 4.3.012 2.807c.008.16.139.287.322.287.18 0 .312-.127.322-.287l.014-2.82-.014-4.287c-.01-.16-.142-.316-.322-.316m1.3.463c-.2 0-.338.153-.344.323l-.01 3.824.01 2.8c.006.168.145.3.345.3a.33.33 0 0 0 .34-.3l.012-2.8-.013-3.824a.336.336 0 0 0-.34-.323m1.2.4a3.63 3.63 0 0 0-1.667.398 3.65 3.65 0 0 0-1.95 3.237v.015l-.003 2.588c0 .185.15.335.337.335h6.6c.46 0 .832-.374.832-.835v-2.03a3.67 3.67 0 0 0-3.67-3.67l-.48-.04z', url: siteSettings.soundCloudUrl },
          ].filter(s => s.url).map((social) => (
            <a
              key={social.label}
              href={social.url!}
              target="_blank"
              rel="noreferrer"
              className="liquid-glass group flex items-center gap-3 rounded-2xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-6 py-4 transition-all hover:border-orange-400/30 hover:from-white/[0.12]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-gray-400 group-hover:text-orange-400 transition-colors" aria-hidden="true">
                <path d={social.icon} />
              </svg>
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">{social.label}</span>
            </a>
          ))}
        </div>
      </section>
      </ScrollReveal>

      {/* ─── Newsletter ─── */}
      <ScrollReveal>
      <section className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <NewsletterSignup />
      </section>
      </ScrollReveal>
      </div>
    </div>
  );
};

export default LandingPage;
