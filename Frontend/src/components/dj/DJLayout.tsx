import { Outlet, NavLink } from 'react-router-dom';
import { Home, Edit, Music, Calendar, BarChart3, ListMusic, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Header from '../common/Header';
import ErrorBoundary from '../common/ErrorBoundary';

const DJLayout = () => {
  const { user } = useAuth();

  const navItems = [
    { to: '/dj-dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" />, end: true },
    { to: '/dj-dashboard/edit-profile', label: 'Edit Profile', icon: <Edit className="w-4 h-4" /> },
    { to: '/dj-dashboard/top10', label: 'Top 10 Tracks', icon: <Music className="w-4 h-4" /> },
    { to: '/dj-dashboard/playlists', label: 'Playlists', icon: <ListMusic className="w-4 h-4" /> },
    { to: '/dj-dashboard/mixes', label: 'Mixes', icon: <Radio className="w-4 h-4" /> },
    { to: '/dj-dashboard/events', label: 'My Events', icon: <Calendar className="w-4 h-4" /> },
    { to: '/dj-dashboard/stats', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#140603] via-[#050202] to-black">
      <Header />

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 min-h-[calc(100vh-80px)] bg-black/90 border-r border-white/10">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold bg-gradient-to-r from-[#FF6B35] to-orange-500 bg-clip-text text-transparent">
              DJ Portal
            </h2>
            <p className="text-sm text-gray-400 mt-1">Welcome, {user?.fullName}</p>
          </div>

          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-[#FF6B35]/20 to-orange-500/20 text-white border border-orange-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5',
                  ].join(' ')
                }
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-20 md:pb-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex bg-black/95 border-t border-white/10 backdrop-blur-md">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-3 text-[0.55rem] uppercase tracking-wider transition-colors ${
                isActive ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default DJLayout;
