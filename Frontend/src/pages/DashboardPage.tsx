import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../apollo-client';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER_TICKETS, UPDATE_USER_PROFILE, HAS_PENDING_DJ_APPLICATION } from '../graphql/queries';
import { Ticket, Calendar, TrendingUp, Upload, Award, Music, Users, Camera, Disc3, Clock, Building2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const DashboardPage = () => {
  const { user, isAuthenticated, isDJ, isOrganizer, updateUserLocal } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [updateUserProfile] = useMutation(UPDATE_USER_PROFILE);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const token = getAccessToken(); // P0-WS3B — in-memory token, not localStorage
      const uploadBase = import.meta.env.VITE_UPLOAD_API_URL ?? 'http://localhost:5000/api/FileUpload/image';
      const response = await fetch(uploadBase, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      const profilePictureUrl: string = data.url;

      await updateUserProfile({
        variables: {
          input: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            profilePictureUrl,
          },
        },
      });

      updateUserLocal({ profilePictureUrl });
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const { data, loading } = useQuery(GET_USER_TICKETS, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    fetchPolicy: 'cache-and-network',
  });

  const { data: pendingAppData } = useQuery(HAS_PENDING_DJ_APPLICATION, {
    variables: { userId: user?.id ?? '' },
    skip: !user || isDJ,
  });
  const hasPendingApp = pendingAppData?.hasPendingDjApplication ?? false;

  const tickets = data?.ticketsByUser ?? [];

  const upcomingTickets = useMemo(() => {
    return tickets.filter((ticket: any) => new Date(ticket.event.date) > new Date());
  }, [tickets]);

  const pastTickets = useMemo(() => {
    return tickets.filter((ticket: any) => new Date(ticket.event.date) <= new Date());
  }, [tickets]);

  const stats = [
    {
      label: 'Active Tickets',
      value: upcomingTickets.length,
      icon: Ticket,
      color: 'from-orange-500 to-[#FF6B35]',
      link: '/tickets',
    },
    {
      label: 'Events Attended',
      value: pastTickets.length,
      icon: Calendar,
      color: 'from-purple-500 to-blue-500',
      link: '/tickets',
    },
    {
      label: 'Total Spent',
      value: `kr ${tickets.reduce((sum: number, t: any) => sum + (t.totalPrice ?? 0), 0).toFixed(0)}`,
      icon: TrendingUp,
      color: 'from-yellow-500 to-orange-500',
      link: '/orders',
    },
  ];

  const quickActions = [
    {
      title: 'Browse Events',
      description: 'Discover upcoming shows and performances',
      icon: Calendar,
      link: '/events',
      color: 'from-orange-500 to-[#FF6B35]',
    },
    {
      title: 'Explore DJs',
      description: 'Follow your favorite artists',
      icon: Users,
      link: '/djs',
      color: 'from-purple-500 to-[#FF6B35]',
    },
    {
      title: 'Upload Media',
      description: 'Share your event moments',
      icon: Upload,
      link: '/upload',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Gallery',
      description: 'View event photos and videos',
      icon: Music,
      color: 'from-green-500 to-emerald-500',
      link: '/gallery',
    },
    {
      title: 'Leaderboard',
      description: 'Check your ranking and points',
      icon: Award,
      color: 'from-yellow-500 to-orange-500',
      link: '/gamification',
    },
    {
      title: 'Playlists',
      description: 'Discover curated music sets',
      icon: Music,
      color: 'from-[#FF6B35] to-red-500',
      link: '/playlists',
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-white">Please Login</h1>
          <p className="text-gray-400">Sign in to access your personalized dashboard</p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold hover:from-orange-400 hover:to-pink-400 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0505] via-[#050202] to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-gradient-to-br from-orange-500 to-[#5D1725] flex items-center justify-center">
              {user?.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {(user?.fullName || 'M')[0].toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-400 border-2 border-black flex items-center justify-center transition-colors disabled:opacity-60"
              title="Change profile picture"
            >
              {avatarUploading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Welcome Back</p>
            <h1 className="text-5xl font-bold">{user?.fullName || 'Music Lover'}</h1>
            <p className="text-gray-400 text-lg">Your personalized music event hub</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Link
                key={index}
                to={stat.link}
                className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 p-6 hover:border-orange-500/30 transition-all"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity`} />
                <div className="relative space-y-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Upcoming Tickets */}
        {upcomingTickets.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Upcoming Events</h2>
              <Link
                to="/tickets"
                className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingTickets.slice(0, 3).map((ticket: any) => (
                <Link
                  key={ticket.id}
                  to={`/events/${ticket.event.id}`}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 overflow-hidden hover:border-orange-500/30 transition-all"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        Active
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold group-hover:text-orange-400 transition-colors">
                        {ticket.event.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(ticket.event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {ticket.event.venueName}
                        {ticket.event.city ? `, ${ticket.event.city}` : ''}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-gray-500">Ticket #{ticket.ticketNumber}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Become a DJ / DJ Application Status */}
        {!isDJ && (
          <section>
            {hasPendingApp ? (
              <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-950/20 via-orange-950/10 to-transparent p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">DJ Application Under Review</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Our team is reviewing your application. You'll be notified once a decision is made.
                  </p>
                </div>
              </div>
            ) : (
              <Link
                to="/dj-enroll"
                className="group block rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-950/20 via-[#5D1725]/10 to-transparent p-6 hover:border-orange-500/40 transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_25px_rgba(255,107,53,0.4)] transition-shadow">
                    <Disc3 className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                      Are You a DJ? Join the Lineup
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Apply to get featured on the platform, connect with venues, and grow your audience.
                    </p>
                  </div>
                  <span className="hidden md:block text-orange-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                    Apply Now →
                  </span>
                </div>
              </Link>
            )}
          </section>
        )}

        {/* Become an Organizer */}
        {!isOrganizer && !isDJ && (
          <section>
            <Link
              to="/organizer-apply"
              className="group block rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/20 via-purple-950/10 to-transparent p-6 hover:border-violet-500/40 transition-all"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-shadow">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                    Host Your Own Events
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Apply as an event organizer to list your shows and sell tickets on the platform.
                  </p>
                </div>
                <span className="hidden md:block text-violet-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                  Apply →
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* Quick Actions */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={index}
                  to={action.link}
                  className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 p-6 hover:border-orange-500/30 transition-all"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity`} />
                  <div className="relative space-y-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-orange-400 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-400">{action.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recent Activity */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
          </div>
        ) : pastTickets.length > 0 ? (
          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Recent Activity</h2>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 divide-y divide-white/10">
              {pastTickets.slice(0, 5).map((ticket: any) => (
                <div key={ticket.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
                      <Ticket className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{ticket.event.title}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(ticket.event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    {ticket.isCheckedIn ? 'Attended' : 'Past'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardPage;
