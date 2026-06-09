import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../context/AuthContext';
import { GET_USER_TICKETS } from '../graphql/queries';
import { Trophy, Award, Star, TrendingUp, Medal, Crown, Zap } from 'lucide-react';

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  unlocked: boolean;
  progress?: number;
  requirement?: number;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  points: number;
  eventsAttended: number;
  badge?: string;
};

const GamificationPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');

  const { data } = useQuery(GET_USER_TICKETS, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    fetchPolicy: 'cache-and-network',
  });

  const tickets = data?.ticketsByUser ?? [];
  const eventsAttended = useMemo(() => {
    return tickets.filter((t: any) => t.isCheckedIn).length;
  }, [tickets]);

  // Calculate user points based on activity
  const userPoints = useMemo(() => {
    let points = 0;
    points += eventsAttended * 100; // 100 points per event attended
    points += tickets.length * 50; // 50 points per ticket purchased
    return points;
  }, [eventsAttended, tickets.length]);

  // Define badges
  const badges: Badge[] = [
    {
      id: '1',
      name: 'First Steps',
      description: 'Purchase your first ticket',
      icon: Star,
      color: 'from-blue-500 to-cyan-500',
      unlocked: tickets.length >= 1,
      progress: Math.min(tickets.length, 1),
      requirement: 1,
    },
    {
      id: '2',
      name: 'Regular',
      description: 'Attend 5 events',
      icon: Award,
      color: 'from-green-500 to-emerald-500',
      unlocked: eventsAttended >= 5,
      progress: eventsAttended,
      requirement: 5,
    },
    {
      id: '3',
      name: 'VIP',
      description: 'Attend 10 events',
      icon: Trophy,
      color: 'from-yellow-500 to-orange-500',
      unlocked: eventsAttended >= 10,
      progress: eventsAttended,
      requirement: 10,
    },
    {
      id: '4',
      name: 'Superfan',
      description: 'Attend 25 events',
      icon: Medal,
      color: 'from-purple-500 to-[#FF6B35]',
      unlocked: eventsAttended >= 25,
      progress: eventsAttended,
      requirement: 25,
    },
    {
      id: '5',
      name: 'Legend',
      description: 'Attend 50 events',
      icon: Crown,
      color: 'from-orange-500 to-red-500',
      unlocked: eventsAttended >= 50,
      progress: eventsAttended,
      requirement: 50,
    },
    {
      id: '6',
      name: 'Early Bird',
      description: 'Purchase 10 tickets in advance',
      icon: Zap,
      color: 'from-[#FF6B35] to-purple-500',
      unlocked: tickets.length >= 10,
      progress: tickets.length,
      requirement: 10,
    },
  ];

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  // Mock leaderboard data (in a real app, this would come from the backend)
  const leaderboard: LeaderboardEntry[] = [
    { rank: 1, userId: '1', username: 'MusicLover123', points: 5000, eventsAttended: 50, badge: 'Legend' },
    { rank: 2, userId: '2', username: 'BassHead', points: 4200, eventsAttended: 42, badge: 'VIP' },
    { rank: 3, userId: '3', username: 'TechnoKing', points: 3800, eventsAttended: 38, badge: 'VIP' },
    { rank: 4, userId: '4', username: 'HouseQueen', points: 3200, eventsAttended: 32, badge: 'VIP' },
    { rank: 5, userId: '5', username: 'EDMFan', points: 2800, eventsAttended: 28, badge: 'Superfan' },
    { rank: 6, userId: user?.id || '6', username: user?.fullName || 'You', points: userPoints, eventsAttended, badge: unlockedBadges[unlockedBadges.length - 1]?.name },
    { rank: 7, userId: '7', username: 'RaveLife', points: 2200, eventsAttended: 22, badge: 'VIP' },
    { rank: 8, userId: '8', username: 'ClubGoer', points: 1800, eventsAttended: 18, badge: 'Regular' },
    { rank: 9, userId: '9', username: 'MusicAddict', points: 1500, eventsAttended: 15, badge: 'Regular' },
    { rank: 10, userId: '10', username: 'PartyStarter', points: 1200, eventsAttended: 12, badge: 'Regular' },
  ].sort((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const userRank = leaderboard.find((entry) => entry.userId === user?.id)?.rank || leaderboard.length + 1;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <Trophy className="w-20 h-20 text-orange-400 mx-auto" />
          <h1 className="text-3xl font-bold text-white">Join the Competition</h1>
          <p className="text-gray-400">Sign in to track your points, unlock badges, and climb the leaderboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold">Leaderboard & Achievements</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Earn points by attending events, unlock exclusive badges, and compete with fellow music lovers
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'badges', label: 'Badges' },
            { id: 'leaderboard', label: 'Leaderboard' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center mx-auto">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-orange-400">{userPoints.toLocaleString()}</p>
                  <p className="text-gray-400">Total Points</p>
                </div>
              </div>

              <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-[#FF6B35] flex items-center justify-center mx-auto">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-purple-400">#{userRank}</p>
                  <p className="text-gray-400">Global Rank</p>
                </div>
              </div>

              <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-green-400">{unlockedBadges.length}/{badges.length}</p>
                  <p className="text-gray-400">Badges Unlocked</p>
                </div>
              </div>
            </div>

            {/* Recent Badges */}
            {unlockedBadges.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Recently Unlocked</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unlockedBadges.slice(-3).reverse().map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <div
                        key={badge.id}
                        className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 space-y-3"
                      >
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${badge.color} flex items-center justify-center`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">{badge.name}</h3>
                          <p className="text-sm text-gray-400">{badge.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="space-y-8">
            {/* Unlocked Badges */}
            {unlockedBadges.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Unlocked ({unlockedBadges.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {unlockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <div
                        key={badge.id}
                        className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 space-y-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${badge.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold">{badge.name}</h3>
                            <p className="text-sm text-gray-400">{badge.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-green-400">
                          <Award className="w-4 h-4" />
                          <span>Unlocked!</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Locked ({lockedBadges.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    const progress = ((badge.progress || 0) / (badge.requirement || 1)) * 100;
                    return (
                      <div
                        key={badge.id}
                        className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 space-y-4 opacity-60"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-8 h-8 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-400">{badge.name}</h3>
                            <p className="text-sm text-gray-500">{badge.description}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Progress</span>
                            <span>{badge.progress || 0} / {badge.requirement}</span>
                          </div>
                          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-[#FF6B35] transition-all duration-500"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold">Top Players</h2>
              </div>
              <div className="divide-y divide-white/10">
                {leaderboard.map((entry) => {
                  const isCurrentUser = entry.userId === user?.id;
                  return (
                    <div
                      key={entry.userId}
                      className={`p-6 flex items-center justify-between transition-colors ${
                        isCurrentUser ? 'bg-orange-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        {/* Rank */}
                        <div className="w-12 text-center">
                          {entry.rank <= 3 ? (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              entry.rank === 1
                                ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                                : entry.rank === 2
                                ? 'bg-gradient-to-br from-gray-400 to-gray-600'
                                : 'bg-gradient-to-br from-orange-700 to-orange-900'
                            }`}>
                              <Crown className="w-6 h-6 text-white" />
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-gray-400">#{entry.rank}</span>
                          )}
                        </div>

                        {/* User Info */}
                        <div>
                          <p className="font-bold text-lg">
                            {entry.username}
                            {isCurrentUser && <span className="ml-2 text-sm text-orange-400">(You)</span>}
                          </p>
                          <p className="text-sm text-gray-400">{entry.eventsAttended} events attended</p>
                          {entry.badge && (
                            <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              {entry.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-400">{entry.points.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* How to Earn Points */}
            <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 space-y-4">
              <h3 className="text-xl font-bold">How to Earn Points</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Attend an Event</p>
                    <p className="text-gray-400">+100 points</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Purchase a Ticket</p>
                    <p className="text-gray-400">+50 points</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamificationPage;
