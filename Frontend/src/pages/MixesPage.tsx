import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_DJ_MIXES } from '../graphql/queries';
import PageSeo from '../components/common/PageSeo';
import { ExternalLink, Music, Play } from 'lucide-react';
import { safeHttpUrl } from '../lib/safeHttpUrl';

type DJMix = {
  id: string;
  title: string;
  description?: string;
  mixUrl: string;
  thumbnailUrl?: string;
  genre?: string;
  mixType?: string;
  djProfileId?: string;
  djName?: string;
  createdAt: string;
};

const platformIcon = (mixType?: string) => {
  if (mixType === 'youtube') return 'YouTube';
  if (mixType === 'soundcloud') return 'SoundCloud';
  if (mixType === 'mixcloud') return 'Mixcloud';
  return 'Listen';
};

const MixesPage = () => {
  const { data, loading, error } = useQuery(GET_DJ_MIXES);
  const [genreFilter, setGenreFilter] = useState('all');

  const mixes: DJMix[] = data?.djMixes ?? [];

  const genreOptions = useMemo(() => {
    const genres = new Set<string>();
    mixes.forEach((m) => {
      if (m.genre) m.genre.split(',').map((g) => g.trim()).filter(Boolean).forEach((g) => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [mixes]);

  const filtered = useMemo(() => {
    if (genreFilter === 'all') return mixes;
    return mixes.filter(
      (m) =>
        m.genre &&
        m.genre
          .split(',')
          .map((g) => g.trim().toLowerCase())
          .includes(genreFilter.toLowerCase()),
    );
  }, [mixes, genreFilter]);

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
        <p className="text-orange-400 text-lg">Unable to load mixes</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Mixes — DJ Sets & Recorded Sessions"
        description="Listen to DJ mixes and recorded sets from KlubN Oslo. Stream the latest sessions from our resident and guest DJs."
        canonical="/mixes"
      />
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5D1725]/30 via-transparent to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.10),transparent_55%)]" />

        <section className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
              <p className="text-sm uppercase tracking-[0.6em] text-orange-400 font-bold">Curated Sessions</p>
            </div>
            <h1 className="font-display text-6xl md:text-7xl font-black leading-tight tracking-tight">
              Mixes{' '}
              <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-[#FF6B35] bg-clip-text text-transparent">
                & Sets
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-3xl leading-relaxed">
              Full-length DJ mixes, live sets, and curated sessions from across the roster. Stream directly on your favourite platform.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 pt-4">
            {[
              { value: mixes.length, label: 'Mixes' },
              { value: genreOptions.length, label: 'Genres' },
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
        </section>
      </div>

      {/* Genre filter */}
      {genreOptions.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setGenreFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                genreFilter === 'all'
                  ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black'
                  : 'border border-white/10 text-gray-400 hover:text-white hover:border-orange-400/30'
              }`}
            >
              All
            </button>
            {genreOptions.map((genre) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genre)}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                  genreFilter === genre
                    ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black'
                    : 'border border-white/10 text-gray-400 hover:text-white hover:border-orange-400/30'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Mixes Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Music className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-2xl font-semibold text-gray-400">No mixes available yet.</p>
            <p className="text-gray-500">Check back soon for new sessions and sets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((mix) => {
              const safeMixUrl = safeHttpUrl(mix.mixUrl);
              return safeMixUrl ? (
              <a
                key={mix.id}
                href={safeMixUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl overflow-hidden border border-white/[0.08] hover:border-orange-400/30 transition-all duration-300 bg-white/[0.02] hover:bg-white/[0.04]"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-black/40">
                  {mix.thumbnailUrl ? (
                    <img
                      src={mix.thumbnailUrl}
                      alt={mix.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-orange-950/30 to-black/60">
                      <Music className="w-12 h-12 text-orange-400/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-14 h-14 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Platform badge */}
                  {mix.mixType && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[0.6rem] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm text-white/80 border border-white/10">
                      {platformIcon(mix.mixType)}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2 p-4 flex-1">
                  <h3 className="text-base font-bold text-white group-hover:text-orange-300 transition-colors line-clamp-2">
                    {mix.title}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {mix.djName && (
                      <span className="text-xs text-orange-400/80 font-medium">{mix.djName}</span>
                    )}
                    {mix.genre && (
                      <>
                        {mix.djName && <span className="text-white/20">|</span>}
                        <span className="text-xs text-gray-500">{mix.genre}</span>
                      </>
                    )}
                  </div>

                  {mix.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{mix.description}</p>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/[0.06]">
                    <span className="text-[0.6rem] text-gray-600 uppercase tracking-wider">
                      {new Date(mix.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                      Listen <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </a>
              ) : null;
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MixesPage;
