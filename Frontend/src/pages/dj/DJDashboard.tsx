import { Link } from 'react-router-dom';
import { Calendar, Music, Edit3, BarChart3, ListMusic, Radio } from 'lucide-react';

const DJDashboard = () => (
  <div className="p-8">
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">DJ Portal</p>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">
          Quick access to your profile, tracks, events, and performance insights.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardTile
          title="Edit Profile"
          description="Update your bio, socials, and media so fans and organizers see your latest story."
          to="/dj-dashboard/edit-profile"
          icon={<Edit3 className="w-5 h-5" />}
        />
        <DashboardTile
          title="Top 10 Tracks"
          description="Curate and manage the tracks that define your sets."
          to="/dj-dashboard/top10"
          icon={<Music className="w-5 h-5" />}
        />
        <DashboardTile
          title="My Playlists"
          description="Create and manage your curated playlists for fans to discover."
          to="/dj-dashboard/playlists"
          icon={<ListMusic className="w-5 h-5" />}
        />
        <DashboardTile
          title="My Mixes"
          description="Publish and maintain your mixes, live sets, and recorded sessions."
          to="/dj-dashboard/mixes"
          icon={<Radio className="w-5 h-5" />}
        />
        <DashboardTile
          title="My Events"
          description="Review upcoming gigs and see your past performances."
          to="/dj-dashboard/events"
          icon={<Calendar className="w-5 h-5" />}
        />
        <DashboardTile
          title="Analytics"
          description="Track followers, engagement, and content performance."
          to="/dj-dashboard/stats"
          icon={<BarChart3 className="w-5 h-5" />}
        />
      </div>
    </div>
  </div>
);

const DashboardTile = ({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
}) => (
  <Link
    to={to}
    className="group rounded-2xl border border-white/10 bg-white/5 p-6 flex items-start gap-3 hover:border-orange-500/40 hover:bg-pink-500/5 transition"
  >
    <div className="rounded-lg bg-white/5 p-2 text-pink-300">{icon}</div>
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white group-hover:text-pink-200">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
      <span className="text-xs uppercase tracking-[0.35em] text-pink-300">Open →</span>
    </div>
  </Link>
);

export default DJDashboard;
