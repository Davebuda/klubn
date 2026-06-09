import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  GET_DJS,
  GET_EVENTS,
  GET_VENUES,
  GET_GENRES,
  GET_PENDING_DJ_APPLICATIONS,
  GET_GALLERY_MEDIA,
  GET_ORGANIZER_APPLICATIONS,
  GET_PENDING_EVENTS,
} from '../../graphql/queries';

const modules = [
  {
    title: 'DJs',
    description: 'Create, edit, and manage all DJ profiles.',
    to: '/admin/djs',
    accent: 'from-orange-600/50 to-[#5D1725]/60',
  },
  {
    title: 'Events',
    description: 'Curate the calendar, assign venues and lineups.',
    to: '/admin/events',
    accent: 'from-[#FF6B35]/40 to-orange-900/60',
  },
  {
    title: 'Venues',
    description: 'Manage venue details, capacity, and contacts.',
    to: '/admin/venues',
    accent: 'from-[#5D1725]/50 to-orange-950/60',
  },
  {
    title: 'Gallery',
    description: 'Approve, feature, or remove user uploads.',
    to: '/admin/gallery',
    accent: 'from-purple-600/40 to-[#5D1725]/50',
  },
  {
    title: 'Genres',
    description: 'Manage genre tags for events and DJs.',
    to: '/admin/genres',
    accent: 'from-emerald-600/30 to-emerald-900/40',
  },
  {
    title: 'Users',
    description: 'View accounts, assign roles, manage access.',
    to: '/admin/users',
    accent: 'from-blue-600/30 to-blue-900/40',
  },
  {
    title: 'Tickets',
    description: 'Issue, check-in, invalidate, and track tickets.',
    to: '/admin/tickets',
    accent: 'from-amber-600/30 to-amber-900/40',
  },
  {
    title: 'Playlists',
    description: 'Manage DJ Top 10 playlists and song catalog.',
    to: '/admin/playlists',
    accent: 'from-rose-600/30 to-rose-900/40',
  },
  {
    title: 'DJ Applications',
    description: 'Review and process pending DJ applications.',
    to: '/admin/dj-applications',
    accent: 'from-cyan-600/30 to-cyan-900/40',
  },
  {
    title: 'Organizer Apps',
    description: 'Approve or reject event organizer applications.',
    to: '/admin/organizer-applications',
    accent: 'from-violet-600/30 to-violet-900/40',
  },
  {
    title: 'Pending Events',
    description: 'Review and approve organizer-submitted events.',
    to: '/admin/pending-events',
    accent: 'from-pink-600/30 to-pink-900/40',
  },
  {
    title: 'Newsletter',
    description: 'View subscribers and manage newsletter.',
    to: '/admin/newsletter',
    accent: 'from-teal-600/30 to-teal-900/40',
  },
  {
    title: 'Content Pages',
    description: 'Edit FAQ, About, and Terms content.',
    to: '/admin/content',
    accent: 'from-indigo-600/30 to-indigo-900/40',
  },
  {
    title: 'Site Settings',
    description: 'Brand, hero, colors, socials, and feature toggles.',
    to: '/admin/site-settings',
    accent: 'from-gray-600/30 to-gray-900/40',
  },
];

const AdminDashboardPage = () => {
  const { data: djsData } = useQuery(GET_DJS);
  const { data: eventsData } = useQuery(GET_EVENTS);
  const { data: venuesData } = useQuery(GET_VENUES);
  const { data: genresData } = useQuery(GET_GENRES);
  const { data: applicationsData } = useQuery(GET_PENDING_DJ_APPLICATIONS);
  const { data: galleryData } = useQuery(GET_GALLERY_MEDIA, { variables: { approvedOnly: false } });
  const { data: organizerAppsData } = useQuery(GET_ORGANIZER_APPLICATIONS);
  const { data: pendingEventsData } = useQuery(GET_PENDING_EVENTS);

  const stats = useMemo(() => {
    const gallery = galleryData?.galleryMedia ?? [];
    const organizerApps = organizerAppsData?.organizerApplications ?? [];
    return {
      djs: djsData?.dJs?.length ?? 0,
      events: eventsData?.events?.length ?? 0,
      venues: venuesData?.venues?.length ?? 0,
      genres: genresData?.genres?.length ?? 0,
      pendingApps: applicationsData?.pendingDjApplications?.length ?? 0,
      totalMedia: gallery.length,
      pendingMedia: gallery.filter((m: { isApproved: boolean }) => !m.isApproved).length,
      pendingOrganizerApps: organizerApps.filter((a: any) => a.status === 'Pending').length,
      pendingEvents: pendingEventsData?.pendingEvents?.length ?? 0,
    };
  }, [djsData, eventsData, venuesData, genresData, applicationsData, galleryData, organizerAppsData, pendingEventsData]);

  const statCards = [
    { label: 'DJs', value: stats.djs, color: 'text-orange-400' },
    { label: 'Events', value: stats.events, color: 'text-orange-400' },
    { label: 'Venues', value: stats.venues, color: 'text-orange-400' },
    { label: 'Genres', value: stats.genres, color: 'text-orange-400' },
    { label: 'Pending DJ Apps', value: stats.pendingApps, color: stats.pendingApps > 0 ? 'text-yellow-400' : 'text-gray-400' },
    { label: 'Pending Media', value: stats.pendingMedia, color: stats.pendingMedia > 0 ? 'text-yellow-400' : 'text-gray-400' },
    { label: 'Org. Apps', value: stats.pendingOrganizerApps, color: stats.pendingOrganizerApps > 0 ? 'text-violet-400' : 'text-gray-400' },
    { label: 'Pending Events', value: stats.pendingEvents, color: stats.pendingEvents > 0 ? 'text-pink-400' : 'text-gray-400' },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Control Center</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-gray-400">
          Overview of your platform. Jump into any module to manage content.
        </p>
      </header>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center"
          >
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action alerts */}
      {(stats.pendingApps > 0 || stats.pendingMedia > 0 || stats.pendingOrganizerApps > 0 || stats.pendingEvents > 0) && (
        <div className="space-y-2">
          {stats.pendingApps > 0 && (
            <Link
              to="/admin/dj-applications"
              className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 transition hover:bg-yellow-500/10"
            >
              <span className="text-sm text-yellow-200">
                {stats.pendingApps} DJ application{stats.pendingApps !== 1 ? 's' : ''} awaiting review
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-yellow-400">Review →</span>
            </Link>
          )}
          {stats.pendingOrganizerApps > 0 && (
            <Link
              to="/admin/organizer-applications"
              className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 transition hover:bg-violet-500/10"
            >
              <span className="text-sm text-violet-200">
                {stats.pendingOrganizerApps} organizer application{stats.pendingOrganizerApps !== 1 ? 's' : ''} awaiting review
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-violet-400">Review →</span>
            </Link>
          )}
          {stats.pendingEvents > 0 && (
            <Link
              to="/admin/pending-events"
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
              to="/admin/gallery"
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
        {modules.map((module) => (
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

export default AdminDashboardPage;
