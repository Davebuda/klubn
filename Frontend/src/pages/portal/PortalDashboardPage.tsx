import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  GET_PENDING_DJ_APPLICATIONS,
  GET_GALLERY_MEDIA,
  GET_PENDING_EVENTS,
} from '../../graphql/queries';

const PortalDashboardPage = () => {
  const { data: applicationsData } = useQuery(GET_PENDING_DJ_APPLICATIONS);
  const { data: galleryData } = useQuery(GET_GALLERY_MEDIA, { variables: { approvedOnly: false } });
  const { data: pendingEventsData } = useQuery(GET_PENDING_EVENTS);

  const stats = useMemo(() => {
    const gallery = galleryData?.galleryMedia ?? [];
    return {
      pendingApps: applicationsData?.pendingDjApplications?.length ?? 0,
      pendingMedia: gallery.filter((m: { isApproved: boolean }) => !m.isApproved).length,
      pendingEvents: pendingEventsData?.pendingEvents?.length ?? 0,
    };
  }, [applicationsData, galleryData, pendingEventsData]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">KlubN Portal</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-gray-400">
          Manage DJs, events, tickets, mixes, playlists, and gallery.
        </p>
      </header>

      {/* Action alerts */}
      {(stats.pendingApps > 0 || stats.pendingMedia > 0 || stats.pendingEvents > 0) && (
        <div className="space-y-2">
          {stats.pendingApps > 0 && (
            <Link
              to="/portal/dj-applications"
              className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 transition hover:bg-yellow-500/10"
            >
              <span className="text-sm text-yellow-200">
                {stats.pendingApps} DJ application{stats.pendingApps !== 1 ? 's' : ''} awaiting review
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-yellow-400">Review →</span>
            </Link>
          )}
          {stats.pendingEvents > 0 && (
            <Link
              to="/portal/pending-events"
              className="flex items-center justify-between rounded-xl border border-pink-500/20 bg-pink-500/5 px-4 py-3 transition hover:bg-pink-500/10"
            >
              <span className="text-sm text-pink-200">
                {stats.pendingEvents} event{stats.pendingEvents !== 1 ? 's' : ''} pending approval
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-pink-400">Review →</span>
            </Link>
          )}
          {stats.pendingMedia > 0 && (
            <Link
              to="/portal/gallery"
              className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 transition hover:bg-yellow-500/10"
            >
              <span className="text-sm text-yellow-200">
                {stats.pendingMedia} gallery upload{stats.pendingMedia !== 1 ? 's' : ''} pending approval
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-yellow-400">Review →</span>
            </Link>
          )}
        </div>
      )}

      {/* Module grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { title: 'DJs', description: 'Create, edit, and manage DJ profiles.', to: '/portal/djs', accent: 'from-orange-600/50 to-[#5D1725]/60' },
          { title: 'DJ Applications', description: 'Review and process pending DJ applications.', to: '/portal/dj-applications', accent: 'from-cyan-600/30 to-cyan-900/40' },
          { title: 'Events', description: 'Curate the calendar, assign venues and lineups.', to: '/portal/events', accent: 'from-[#FF6B35]/40 to-orange-900/60' },
          { title: 'Pending Events', description: 'Review and approve organizer-submitted events.', to: '/portal/pending-events', accent: 'from-pink-600/30 to-pink-900/40' },
          { title: 'Tickets', description: 'Issue, check-in, invalidate, and track tickets.', to: '/portal/tickets', accent: 'from-amber-600/30 to-amber-900/40' },
          { title: 'Mixes', description: 'Manage DJ mixes and recordings.', to: '/portal/mixes', accent: 'from-violet-600/30 to-violet-900/40' },
          { title: 'Playlists', description: 'Manage DJ Top 10 playlists.', to: '/portal/playlists', accent: 'from-rose-600/30 to-rose-900/40' },
          { title: 'Gallery', description: 'Approve, feature, or remove user uploads.', to: '/portal/gallery', accent: 'from-purple-600/40 to-[#5D1725]/50' },
        ].map((module) => (
          <Link
            key={module.to}
            to={module.to}
            className={`group rounded-2xl border border-white/10 bg-gradient-to-br ${module.accent} p-5 transition hover:scale-[1.01] hover:border-white/20`}
          >
            <div className="flex flex-col gap-2">
              <div className="text-[0.6rem] uppercase tracking-[0.4em] text-white/50">Manage</div>
              <h2 className="text-lg font-semibold">{module.title}</h2>
              <p className="text-xs text-white/70">{module.description}</p>
              <span className="mt-1 text-[0.6rem] uppercase tracking-[0.35em] text-white/80 group-hover:text-white transition-colors">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PortalDashboardPage;
