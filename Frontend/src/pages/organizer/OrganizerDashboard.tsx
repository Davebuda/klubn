import { Link } from 'react-router-dom';
import { Calendar, PlusCircle, BarChart3 } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_MY_ORGANIZER_EVENTS } from '../../graphql/queries';

const OrganizerDashboard = () => {
  const { user } = useAuth();
  const { data } = useQuery(GET_MY_ORGANIZER_EVENTS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const events = data?.myOrganizerEvents ?? [];
  const published = events.filter((e: any) => e.status === 'Published').length;
  const pending = events.filter((e: any) => e.status === 'PendingApproval').length;
  const rejected = events.filter((e: any) => e.status === 'Rejected').length;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-400">Organizer Portal</p>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400">Manage your events and track their status.</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Published', value: published, color: 'text-green-400' },
            { label: 'Pending Review', value: pending, color: 'text-orange-400' },
            { label: 'Rejected', value: rejected, color: 'text-red-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tiles */}
        <div className="grid gap-4 md:grid-cols-2">
          <DashTile
            title="My Events"
            description="View, edit, and manage all your submitted events."
            to="/organizer-dashboard/events"
            icon={<Calendar className="w-5 h-5" />}
          />
          <DashTile
            title="Create New Event"
            description="Submit a new event for admin review and publication."
            to="/organizer-dashboard/events/new"
            icon={<PlusCircle className="w-5 h-5" />}
          />
          <DashTile
            title="Analytics"
            description="Track ticket sales and event performance (coming soon)."
            to="/organizer-dashboard/events"
            icon={<BarChart3 className="w-5 h-5" />}
            disabled
          />
        </div>
      </div>
    </div>
  );
};

const DashTile = ({
  title,
  description,
  to,
  icon,
  disabled,
}: {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) => (
  <Link
    to={disabled ? '#' : to}
    className={`group rounded-2xl border border-white/10 bg-white/5 p-6 flex items-start gap-3 transition ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-500/40 hover:bg-orange-500/5'
    }`}
    onClick={disabled ? (e) => e.preventDefault() : undefined}
  >
    <div className="rounded-lg bg-white/5 p-2 text-orange-400">{icon}</div>
    <div className="space-y-1.5">
      <h3 className="text-lg font-semibold text-white group-hover:text-orange-200">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
      {!disabled && <span className="text-xs uppercase tracking-[0.35em] text-orange-400">Open →</span>}
    </div>
  </Link>
);

export default OrganizerDashboard;
