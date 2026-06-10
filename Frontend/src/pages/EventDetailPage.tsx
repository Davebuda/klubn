import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, MapPin, Clock, Calendar, Users, Music, ChevronLeft } from 'lucide-react';
import { GET_EVENT_BY_ID, GET_EVENTS, GET_GENRES, GET_DJS } from '../graphql/queries';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import { ScrollReveal } from '../components/effects/ScrollReveal';
import { TiltCard } from '../components/effects/TiltCard';

type DJ = { id: string; stageName: string; profilePictureUrl?: string; genre: string };
type Genre = { id: string; name: string };
type RelatedEvent = { id: string; title: string; date: string; price: number; imageUrl?: string; genres: string[]; venue: { id: string; name: string; city: string } };

const VenueGallery = ({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden">
      {images.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === currentIndex ? 1 : 0 }}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIndex ? 'bg-orange-400' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EventDetailPage = () => {
  const { id } = useParams();
  const { siteSettings } = useSiteSettings();
  const defaultImage = siteSettings.defaultEventImageUrl ?? '/media/defaults/event.svg';

  const { data, loading, error } = useQuery(GET_EVENT_BY_ID, { variables: { id }, skip: !id });
  const { data: genresData } = useQuery(GET_GENRES);
  const { data: djsData } = useQuery(GET_DJS);
  const { data: eventsData } = useQuery(GET_EVENTS);

  const event = data?.event;

  // Resolve genre IDs to names
  const genreNames = useMemo(() => {
    if (!event?.genreIds?.length || !genresData?.genres) return [];
    const genreMap = new Map<string, string>();
    genresData.genres.forEach((g: Genre) => genreMap.set(g.id, g.name));
    return event.genreIds.map((gid: string) => genreMap.get(gid)).filter(Boolean) as string[];
  }, [event?.genreIds, genresData]);

  // Resolve DJ IDs to profiles
  const eventDJs = useMemo(() => {
    if (!event?.djIds?.length || !djsData?.dJs) return [];
    const djMap = new Map<string, DJ>();
    djsData.dJs.forEach((dj: DJ) => djMap.set(dj.id, dj));
    return event.djIds.map((did: string) => djMap.get(did)).filter(Boolean) as DJ[];
  }, [event?.djIds, djsData]);

  // Related events (same genres, exclude current)
  const relatedEvents = useMemo(() => {
    if (!eventsData?.events || !event) return [];
    const eventGenres = new Set(genreNames.map((g: string) => g.toLowerCase()));
    return (eventsData.events as RelatedEvent[])
      .filter((e) => e.id !== event.id && e.genres.some((g: string) => eventGenres.has(g.toLowerCase())))
      .slice(0, 4);
  }, [eventsData, event, genreNames]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p className="text-gray-400">Missing event id.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Event</p>
          <h1 className="text-3xl font-bold text-white">Unable to load this event.</h1>
          <p className="text-gray-400">{error?.message ?? 'It may have been removed.'}</p>
          <Link to="/events" className="inline-block mt-4 px-6 py-3 rounded-full bg-white/10 border border-white/15 text-white text-sm font-semibold hover:border-orange-400 transition">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();
  const heroImage = event.imageUrl || defaultImage;

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description ?? '',
    startDate: event.date,
    image: heroImage,
    url: `https://klubn.no/events/${event.id}`,
    eventStatus: isPast ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: event.venue ? {
      '@type': 'Place',
      name: event.venue.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.venue.city ?? 'Oslo',
        addressCountry: 'NO',
      },
    } : { '@type': 'Place', name: 'Oslo, Norway' },
    organizer: {
      '@type': 'Organization',
      name: 'KlubN',
      url: 'https://klubn.no',
    },
    ...(event.price != null && {
      offers: {
        '@type': 'Offer',
        price: event.price,
        priceCurrency: 'NOK',
        availability: isPast ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: `https://klubn.no/events/${event.id}`,
      },
    }),
    performer: eventDJs.map((dj) => ({
      '@type': 'Person',
      name: dj.stageName || dj.id,
    })),
  };

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title={`${event.title} — KlubN Event`}
        description={event.description ? `${event.description.slice(0, 155)}` : `${event.title} at ${event.venue?.name ?? 'Oslo'}. Tickets and info on KlubN.`}
        canonical={`/events/${event.id}`}
        image={heroImage}
        type="article"
        jsonLd={eventJsonLd}
      />
      {/* ═══ Hero ═══ */}
      <section className="relative isolate overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src={heroImage} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-16 min-h-[50vh] flex flex-col justify-end">
          {/* Back link */}
          <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-orange-400 transition mb-8 w-fit">
            <ChevronLeft className="w-4 h-4" />
            All Events
          </Link>

          {/* Genre tags */}
          {genreNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genreNames.map((genre: string) => (
                <span key={genre} className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-300 text-[11px] uppercase tracking-wider font-semibold">
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
            {event.title}
          </h1>

          {/* Meta strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-400" />
              {event.venue.name}, {event.venue.city}
            </span>
          </div>

          {/* CTA row */}
          <div className="flex flex-wrap gap-3 mt-8">
            {!isPast && event.ticketingUrl ? (
              <a
                href={event.ticketingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white font-bold text-sm tracking-wide hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] hover:scale-[1.02] transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Get Tickets — kr {event.price}
              </a>
            ) : !isPast ? (
              <Link
                to={`/events/${event.id}/tickets`}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white font-bold text-sm tracking-wide hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] hover:scale-[1.02] transition-all"
              >
                Get Tickets — kr {event.price}
              </Link>
            ) : (
              <span className="px-8 py-3.5 rounded-full bg-white/10 border border-white/10 text-gray-400 text-sm font-semibold">
                Event has ended
              </span>
            )}
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="px-6 py-3.5 rounded-full border border-white/15 bg-white/5 text-white text-sm font-semibold hover:border-orange-400/40 hover:bg-white/10 transition-all"
            >
              Share Event
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Main Content Grid ═══ */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          {/* ── Left Column ── */}
          <div className="space-y-12">
            {/* About */}
            <ScrollReveal>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">About This Event</p>
                <p className="text-gray-300 text-base lg:text-lg leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            </ScrollReveal>

            {/* Event video */}
            {event.videoUrl && (
              <ScrollReveal>
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">Event Promo</p>
                  <div className="rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video">
                    <video
                      src={event.videoUrl}
                      controls
                      poster={heroImage}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* DJ Lineup */}
            {eventDJs.length > 0 && (
              <ScrollReveal>
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-orange-400" />
                    <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">DJ Lineup</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {eventDJs.map((dj) => (
                      <Link
                        key={dj.id}
                        to={`/djs/${dj.id}`}
                        className="group rounded-2xl border border-white/10 bg-white/[0.04] hover:border-orange-400/30 hover:bg-white/[0.08] transition-all overflow-hidden"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={dj.profilePictureUrl || siteSettings.defaultDjImageUrl || '/media/defaults/dj.svg'}
                            alt={dj.stageName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-3 space-y-1">
                          <p className="text-sm font-bold text-white group-hover:text-orange-400 transition truncate">{dj.stageName}</p>
                          <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider truncate">{dj.genre?.split(',')[0]?.trim()}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* Venue Details */}
            <ScrollReveal>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">Venue</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
                  {(() => {
                    const venueImages = [
                      ...(event.venue.imageUrls ?? []),
                      ...(event.venue.imageUrl && !(event.venue.imageUrls ?? []).includes(event.venue.imageUrl) ? [event.venue.imageUrl] : []),
                    ].filter(Boolean);
                    return venueImages.length > 0 ? <VenueGallery images={venueImages} /> : null;
                  })()}
                  <h3 className="text-xl font-bold">{event.venue.name}</h3>
                  <p className="text-gray-400 text-sm">
                    {event.venue.address}{event.venue.city ? `, ${event.venue.city}` : ''}{event.venue.country ? `, ${event.venue.country}` : ''}
                  </p>
                  {event.venue.description && (
                    <p className="text-gray-400 text-sm leading-relaxed pt-2 border-t border-white/10">
                      {event.venue.description}
                    </p>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* ── Right Column — Sticky Ticket Card ── */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
            {/* Ticket Card */}
            <TiltCard intensity={4}>
              <div className="rounded-[32px] border border-orange-400/20 bg-gradient-to-b from-orange-400/[0.08] via-white/[0.04] to-white/[0.02] backdrop-blur-xl p-7 space-y-5">
                {/* Price */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-orange-200/50">From</p>
                    <p className="text-4xl font-black text-orange-400">kr {event.price}</p>
                  </div>
                  {isPast ? (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                      Past Event
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider border border-green-500/30">
                      On Sale
                    </span>
                  )}
                </div>

                {/* Date & Time */}
                <div className="space-y-3 pt-3 border-t border-orange-400/15">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-orange-300 text-[9px] uppercase font-bold leading-none">
                        {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-orange-100 text-lg font-black leading-none mt-0.5">
                        {eventDate.getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {eventDate.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {eventDate.getFullYear()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-start gap-3 pt-3 border-t border-orange-400/15">
                  <MapPin className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">{event.venue.name}</p>
                    <p className="text-xs text-gray-400">{event.venue.city}{event.venue.country ? `, ${event.venue.country}` : ''}</p>
                  </div>
                </div>

                {/* Genres */}
                {genreNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-orange-400/15">
                    <Music className="w-3.5 h-3.5 text-orange-400 mt-0.5" />
                    {genreNames.map((genre: string) => (
                      <span key={genre} className="px-2.5 py-0.5 rounded-full bg-orange-400/10 border border-orange-400/20 text-orange-300 text-[10px] uppercase tracking-wider">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA */}
                {!isPast && event.ticketingUrl ? (
                  <a
                    href={event.ticketingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-6 py-4 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-sm font-bold text-center hover:from-orange-300 hover:to-orange-400 transition-all tracking-wide"
                  >
                    Get Tickets
                  </a>
                ) : !isPast ? (
                  <Link
                    to={`/events/${event.id}/tickets`}
                    className="block w-full px-6 py-4 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-sm font-bold text-center hover:from-orange-300 hover:to-orange-400 transition-all tracking-wide"
                  >
                    Get Tickets
                  </Link>
                ) : (
                  <div className="px-6 py-4 rounded-full bg-white/5 border border-white/10 text-gray-500 text-sm font-semibold text-center">
                    This event has ended
                  </div>
                )}
              </div>
            </TiltCard>

            {/* DJ mini-list in sidebar */}
            {eventDJs.length > 0 && (
              <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-semibold">Performing</p>
                <div className="space-y-2">
                  {eventDJs.map((dj) => (
                    <Link key={dj.id} to={`/djs/${dj.id}`} className="flex items-center gap-3 hover:bg-white/5 rounded-xl px-2 py-2 -mx-2 transition">
                      <img
                        src={dj.profilePictureUrl || siteSettings.defaultDjImageUrl || '/media/defaults/dj.svg'}
                        alt={dj.stageName}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{dj.stageName}</p>
                        <p className="text-[0.6rem] text-gray-500 truncate">{dj.genre?.split(',')[0]?.trim()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Related Events ═══ */}
      {relatedEvents.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-16">
          <ScrollReveal>
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">More Like This</p>
                  <h2 className="text-2xl lg:text-3xl font-bold">Related Events</h2>
                </div>
                <Link to="/events" className="text-sm text-orange-400 font-semibold hover:text-orange-300 transition hidden sm:block">
                  View All →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {relatedEvents.map((re) => (
                  <TiltCard key={re.id} intensity={8}>
                    <Link
                      to={`/events/${re.id}`}
                      className="group block rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-orange-400/30 hover:scale-[1.02] transition-all duration-300"
                    >
                      <div className="relative overflow-hidden aspect-[16/10]">
                        <img
                          src={re.imageUrl || defaultImage}
                          alt={re.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-400/80">
                          {new Date(re.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                          {re.title}
                        </h3>
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-xs text-gray-400 line-clamp-1">{re.venue?.name ?? 'TBA'}</p>
                          <p className="text-sm font-bold bg-gradient-to-br from-orange-400 to-[#FF6B35] bg-clip-text text-transparent">
                            kr {re.price}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </TiltCard>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ═══ Bottom CTA ═══ */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-orange-500/[0.06] via-white/[0.03] to-white/[0.01] p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-xl font-bold">Don't miss out</h3>
            <p className="text-sm text-gray-400 max-w-md">
              Browse more events, follow your favorite DJs, and never miss a night.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/events" className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-sm font-bold hover:from-orange-300 hover:to-orange-400 transition-all">
              All Events
            </Link>
            <Link to="/djs" className="px-6 py-3 rounded-full border border-white/15 bg-white/5 text-white text-sm font-semibold hover:border-orange-400/40 transition">
              View DJs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EventDetailPage;
