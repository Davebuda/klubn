import { NavLink, Outlet } from 'react-router-dom';
import Header from '../common/Header';
import Footer from '../common/Footer';
import ErrorBoundary from '../common/ErrorBoundary';

const portalNav = [
  { label: 'Overview', path: '/portal' },
  { label: 'DJs', path: '/portal/djs' },
  { label: 'DJ Applications', path: '/portal/dj-applications' },
  { label: 'Events', path: '/portal/events' },
  { label: 'Pending Events', path: '/portal/pending-events' },
  { label: 'Tickets', path: '/portal/tickets' },
  { label: 'Mixes', path: '/portal/mixes' },
  { label: 'Playlists', path: '/portal/playlists' },
  { label: 'Gallery', path: '/portal/gallery' },
  { label: 'Venues', path: '/portal/venues' },
];

const PortalLayout = () => (
  <div className="min-h-screen bg-black text-white flex flex-col">
    <Header />
    <main className="flex-1 w-full">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8 lg:flex-row">
        <nav className="flex w-full flex-wrap items-stretch gap-2 rounded-3xl border border-white/10 bg-white/5 p-3 text-[0.65rem] uppercase tracking-[0.35em] lg:w-64 lg:flex-col">
          {portalNav.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                [
                  'flex-1 rounded-2xl px-4 py-3 text-center transition-all',
                  isActive
                    ? 'bg-white text-black font-semibold shadow-[0_10px_30px_rgba(255,255,255,0.35)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/10',
                ].join(' ')
              }
              end={path === '/portal'}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <section className="flex-1 space-y-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default PortalLayout;
