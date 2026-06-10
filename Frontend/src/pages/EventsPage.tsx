import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_EVENTS, GET_GENRES } from '../graphql/queries';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';

type Event = {
  id: string;
  title: string;
  description: string;
  date: string;
  price: number;
  imageUrl?: string;
  genres: string[];
  venue: {
    id: string;
    name: string;
    city: string;
    imageUrl?: string;
    imageUrls?: string[];
  };
};

const VenueImageCarousel = ({ images }: { images: string[] }) => {
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
    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
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
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1 h-1 rounded-full transition-colors ${i === currentIndex ? 'bg-orange-400' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type Genre = {
  id: string;
  name: string;
};

const EventsPage = () => {
  const { data: eventsData, loading: eventsLoading, error: eventsError } = useQuery(GET_EVENTS);
  const { data: genresData } = useQuery(GET_GENRES);
  const { siteSettings } = useSiteSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const events: Event[] = eventsData?.events ?? [];
  const genres: Genre[] = genresData?.genres ?? [];
  const defaultEventImage = siteSettings.defaultEventImageUrl ?? '/media/defaults/event.svg';

  // Collect all unique genre names from events themselves (for the pill buttons)
  const eventGenreNames = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [events]);

  const now = useMemo(() => new Date(), []);

  // Sort events: upcoming first (by date asc), then past events at the end
  const sortedEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        event.venue.name.toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      const aIsPast = new Date(a.date) < now;
      const bIsPast = new Date(b.date) < now;
      // Past events sink to bottom
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      if (selectedGenre !== 'all') {
        const aMatch = a.genres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase()) ? 0 : 1;
        const bMatch = b.genres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase()) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return aIsPast
        ? new Date(b.date).getTime() - new Date(a.date).getTime() // past: most-recent first
        : new Date(a.date).getTime() - new Date(b.date).getTime(); // upcoming: soonest first
    });

    return filtered;
  }, [events, searchQuery, selectedGenre, now]);

  if (eventsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center space-y-2 px-6">
        <p className="text-orange-400 text-lg">Unable to load events</p>
        <p className="text-gray-500 text-sm">{eventsError.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Events — Oslo Club Nights & DJ Sets"
        description={siteSettings.eventsTagline || 'Discover upcoming club nights, DJ sets, and events in Oslo. Book tickets for KlubN events.'}
        canonical="/events"
      />
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.5em] text-orange-500">Discover</p>
        <h1 className="text-4xl md:text-6xl font-black leading-tight">
          Upcoming <span className="text-orange-200">Events</span>
        </h1>
      </section>

      {/* Tagline + Search */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-8 space-y-6">
        <p className="text-base md:text-lg text-gray-300/80 leading-relaxed max-w-2xl">
          {siteSettings.eventsTagline || 'Curated nights. Handpicked lineups.'}
          <span className="text-orange-400 font-medium"> Every set tells a story</span> — find yours.
        </p>

        <input
          type="text"
          placeholder="Search by title, venue, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-xl px-5 py-3 rounded-full bg-white/[0.04] border border-white/[0.10] text-white text-sm placeholder-gray-500 focus:border-orange-400 focus:outline-none transition"
        />
      </section>

      {/* Genre Pills */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedGenre('all')}
            className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
              selectedGenre === 'all'
                ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black shadow-lg shadow-orange-600/25'
                : 'border border-white/[0.10] bg-white/[0.04] text-gray-300 hover:border-orange-400/40 hover:text-white'
            }`}
          >
            All
          </button>
          {(eventGenreNames.length > 0 ? eventGenreNames : genres.map((g) => g.name)).map((name) => {
            const isActive = selectedGenre.toLowerCase() === name.toLowerCase();
            const count = events.filter((e) => e.genres.some((g) => g.toLowerCase() === name.toLowerCase())).length;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedGenre(isActive ? 'all' : name)}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black shadow-lg shadow-orange-600/25'
                    : 'border border-white/[0.10] bg-white/[0.04] text-gray-300 hover:border-orange-400/40 hover:text-white'
                }`}
              >
                {name}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? 'text-black/50' : 'text-gray-500'}`}>{count}</span>
                )}
              </button>
            );
          })}

          {(searchQuery || selectedGenre !== 'all') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedGenre('all'); }}
              className="ml-2 px-3 py-2 rounded-full text-[0.65rem] uppercase tracking-wider text-orange-400/60 hover:text-orange-400 transition"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Events Section — Featured + Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-16">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-2xl font-semibold text-gray-400">No events found</p>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Featured Event — 30% left */}
            {(() => {
              const featured = sortedEvents[0];
              const featuredIsPast = new Date(featured.date) < now;
              return (
                <div className="w-full sm:w-[80%] sm:mx-auto lg:w-[30%] lg:min-w-[300px] flex-shrink-0 lg:sticky lg:top-24 lg:self-start">
                  <div
                    className="liquid-glass-warm rounded-[32px] overflow-hidden transition-all duration-300 group hover:scale-[1.01] relative border border-orange-400/20 bg-gradient-to-b from-orange-400/[0.10] via-white/[0.04] to-white/[0.02] backdrop-blur-xl"
                  >
                    {/* Featured / Past badge */}
                    <div className="absolute top-5 left-5 z-10 flex gap-2">
                      {featuredIsPast ? (
                        <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white/70 text-[10px] font-bold uppercase tracking-[0.3em] border border-white/20">
                          Past Event
                        </span>
                      ) : (
                        <span className="px-4 py-1.5 rounded-full bg-orange-500 text-black text-[10px] font-bold uppercase tracking-[0.3em]">
                          Headliner
                        </span>
                      )}
                    </div>

                    {/* Featured Image */}
                    <div className="relative overflow-hidden aspect-[3/4] bg-[#0a0a0a] min-h-[220px]">
                      <img
                        src={featured.imageUrl || defaultEventImage}
                        alt={featured.title}
                        className="absolute inset-0 h-full w-full object-contain group-hover:scale-[1.03] group-hover:brightness-110 transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1008] via-[#1a1008]/60 to-transparent" />
                    </div>

                    {/* Featured Info — warm lighter tone */}
                    <div className="p-7 space-y-4 -mt-8 relative z-10">
                      {/* Date highlight */}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex flex-col items-center justify-center">
                          <span className="text-orange-300 text-[10px] uppercase font-bold leading-none">
                            {new Date(featured.date).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-orange-100 text-lg font-black leading-none mt-0.5">
                            {new Date(featured.date).getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="text-orange-200/80 text-xs uppercase tracking-[0.4em]">
                            {new Date(featured.date).toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-orange-100/50 text-xs mt-0.5">
                            {new Date(featured.date).toLocaleDateString('en-US', { year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <h3 className="text-2xl lg:text-3xl font-black text-orange-50 leading-tight group-hover:text-orange-200 transition">
                        {featured.title}
                      </h3>

                      <p className="text-orange-100/50 text-sm leading-relaxed line-clamp-4">
                        {featured.description}
                      </p>

                      {/* Genres */}
                      {featured.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {featured.genres.map((genre) => (
                            <span
                              key={genre}
                              className="px-3 py-1 rounded-full bg-orange-400/10 border border-orange-400/20 text-orange-300 text-[11px] uppercase tracking-wider"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Venue + Price */}
                      <div className="flex items-end justify-between pt-4 border-t border-orange-400/15">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const venueImages = [
                              ...(featured.venue.imageUrls ?? []),
                              ...(featured.venue.imageUrl && !(featured.venue.imageUrls ?? []).includes(featured.venue.imageUrl) ? [featured.venue.imageUrl] : []),
                            ].filter(Boolean);
                            return venueImages.length > 0 ? <VenueImageCarousel images={venueImages} /> : null;
                          })()}
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.4em] text-orange-200/40">Venue</p>
                            <p className="text-sm text-orange-100 font-medium">{featured.venue.name}</p>
                            <p className="text-xs text-orange-200/40">{featured.venue.city}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.4em] text-orange-200/40">From</p>
                          <p className="text-3xl font-black text-orange-400">kr {featured.price}</p>
                        </div>
                      </div>

                      {/* CTA Buttons */}
                      <Link
                        to={`/events/${featured.id}`}
                        className={`block w-full px-6 py-4 rounded-full text-sm font-bold text-center transition-all tracking-wide mt-2 ${
                          featuredIsPast
                            ? 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15'
                            : 'bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black hover:from-orange-300 hover:to-orange-400'
                        }`}
                      >
                        {featuredIsPast ? 'View Recap' : 'View Event Details'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Remaining Events Grid — 70% right */}
            <div className="lg:w-[70%]">
              {sortedEvents.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {sortedEvents.slice(1).map((event) => {
                    const isRelevant = selectedGenre === 'all' || event.genres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase());
                    const isPast = new Date(event.date) < now;
                    return (
                    <div
                      key={event.id}
                      className={`liquid-glass rounded-[32px] border bg-gradient-to-b from-white/[0.10] to-white/[0.02] backdrop-blur-xl transition-all duration-300 group overflow-hidden hover:scale-[1.02] ${
                        isPast
                          ? 'border-white/[0.06] opacity-60 hover:opacity-80'
                          : isRelevant
                          ? 'border-white/[0.10] opacity-100 hover:border-orange-400/30'
                          : 'border-white/[0.06] opacity-50'
                      }`}
                    >
                      {/* Event Image */}
                      <div className="relative overflow-hidden aspect-[3/4] bg-[#0a0a0a]">
                        <img
                          src={event.imageUrl || defaultEventImage}
                          alt={event.title}
                          className={`absolute inset-0 h-full w-full object-contain group-hover:scale-[1.03] group-hover:brightness-110 transition-all duration-500 ${isPast ? 'grayscale' : ''}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
                        {isPast && (
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white/60 text-[10px] font-bold uppercase tracking-wider border border-white/20">
                              Past Event
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Event Info */}
                      <div className="p-5 space-y-2.5">
                        <p className={`text-xs uppercase tracking-[0.5em] ${isPast ? 'text-gray-600' : 'text-gray-500'}`}>
                          {new Date(event.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <h3 className={`text-xl font-semibold transition ${isPast ? 'text-gray-400 group-hover:text-gray-300' : 'group-hover:text-orange-200'}`}>{event.title}</h3>
                        <p className="text-gray-500 text-sm line-clamp-2">{event.description}</p>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <div className="flex items-center gap-3">
                            {(() => {
                              const venueImages = [
                                ...(event.venue.imageUrls ?? []),
                                ...(event.venue.imageUrl && !(event.venue.imageUrls ?? []).includes(event.venue.imageUrl) ? [event.venue.imageUrl] : []),
                              ].filter(Boolean);
                              return venueImages.length > 0 ? <VenueImageCarousel images={venueImages} /> : null;
                            })()}
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Venue</p>
                              <p className={`text-sm ${isPast ? 'text-gray-500' : 'text-white'}`}>{event.venue.name}</p>
                              <p className="text-xs text-gray-600">{event.venue.city}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Price</p>
                            <p className={`text-2xl font-bold ${isPast ? 'text-gray-500' : 'text-orange-400'}`}>kr {event.price}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Link
                            to={`/events/${event.id}`}
                            className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/15 text-white text-sm font-semibold text-center hover:border-orange-400 transition"
                          >
                            Details
                          </Link>
                          {!isPast && (
                            <Link
                              to={`/events/${event.id}`}
                              className="flex-1 px-4 py-3 rounded-full font-semibold text-sm tracking-wide text-center transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black hover:from-orange-300 hover:to-pink-400"
                            >
                              View Event
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
              {sortedEvents.length === 1 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 text-lg">More events coming soon</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Closing Statement */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="text-center space-y-3">
          <p className="text-white/20 text-xs uppercase tracking-[0.6em]">Oslo &middot; Underground &middot; Electronic</p>
          <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
            New events drop weekly. Follow us to never miss a night.
          </p>
        </div>
      </section>
    </div>
  );
};

export default EventsPage;
