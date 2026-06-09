import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_DJS, GET_DJ_BY_ID, GET_DJ_TOP10_LISTS } from '../../graphql/queries';
import { TrendingUp, Users, Music, Calendar, Eye, Heart, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';

const DJAnalytics = () => {
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);

  const { data: djsData } = useQuery(GET_DJS);
  const { data: djData } = useQuery(GET_DJ_BY_ID, {
    variables: { id: djId },
    skip: !djId,
  });
  const { data: top10Data } = useQuery(GET_DJ_TOP10_LISTS);

  useEffect(() => {
    if (djsData?.dJs) {
      const profile = djsData.dJs.find((dj: any) =>
        dj.userId === user?.id
      );
      if (profile) setDjId(profile.id);
    }
  }, [djsData, user]);

  const dj = djData?.dj;
  const myTop10 = top10Data?.djTop10Lists?.find((list: any) => list.djId === djId);

  const stats = {
    followers: dj?.followerCount || 0,
    events: dj?.upcomingEvents?.length || 0,
    topTracks: myTop10?.top10Songs?.length || 0,
    profileViews: 247, // Placeholder
    totalPlays: 1834, // Placeholder
    avgEngagement: 8.5, // Placeholder
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Analytics & Insights</h1>
          <p className="text-gray-400">Track your growth and engagement metrics</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Total Followers"
            value={stats.followers}
            change={+12}
            color="from-blue-500 to-cyan-500"
          />
          <StatCard
            icon={<Eye className="w-6 h-6" />}
            label="Profile Views (30d)"
            value={stats.profileViews}
            change={+23}
            color="from-purple-500 to-[#FF6B35]"
          />
          <StatCard
            icon={<Music className="w-6 h-6" />}
            label="Track Plays (30d)"
            value={stats.totalPlays}
            change={+45}
            color="from-orange-500 to-red-500"
          />
        </div>

        {/* Engagement Metrics */}
        <section className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Engagement Metrics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Average Engagement Rate</span>
                <span className="text-sm font-semibold text-green-400">{stats.avgEngagement}%</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                  style={{ width: `${stats.avgEngagement * 10}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Profile Completion</span>
                <span className="text-sm font-semibold text-blue-400">85%</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                  style={{ width: '85%' }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <MetricBox label="Likes" value="342" icon={<Heart className="w-4 h-4" />} />
            <MetricBox label="Shares" value="89" icon={<TrendingUp className="w-4 h-4" />} />
            <MetricBox label="Comments" value="127" icon={<Users className="w-4 h-4" />} />
            <MetricBox label="Bookmarks" value="56" icon={<Calendar className="w-4 h-4" />} />
          </div>
        </section>

        {/* Growth Trends */}
        <section className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Growth Trends (Last 30 Days)</h2>

          <div className="space-y-4">
            <TrendItem label="New Followers" value={12} total={stats.followers} positive />
            <TrendItem label="Profile Views" value={23} total={247} positive />
            <TrendItem label="Track Plays" value={45} total={1834} positive />
            <TrendItem label="Engagement Rate" value={-2} total={8.5} />
          </div>
        </section>

        {/* Top Performing Content */}
        <section className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Top Performing Content</h2>

          <div className="space-y-3">
            {myTop10?.top10Songs?.slice(0, 5).map((entry: any, index: number) => (
              <div
                key={entry.id}
                className="bg-black/30 border border-white/10 rounded-lg p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded bg-gradient-to-br from-[#FF6B35] to-orange-500 flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {entry.song?.title || 'Unknown Track'}
                  </h3>
                  <p className="text-sm text-gray-400 truncate">
                    {entry.song?.artist || 'Unknown Artist'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {Math.floor(Math.random() * 500) + 100} plays
                  </div>
                  <div className="text-xs text-gray-400">This month</div>
                </div>
              </div>
            )) || (
              <p className="text-center text-gray-500 py-8">No tracks in your Top 10 yet</p>
            )}
          </div>
        </section>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-2">Analytics Coming Soon!</h3>
          <p className="text-sm text-gray-300">
            We're working on advanced analytics features including:
            real-time tracking, audience demographics, peak engagement times, and much more.
            Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, change, color }: any) => (
  <div className="bg-white/5 border border-white/10 rounded-lg p-6">
    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} bg-opacity-20 flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <div className="text-3xl font-bold text-white mb-1">{value}</div>
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-xs font-semibold flex items-center gap-1 ${
        change > 0 ? 'text-green-400' : 'text-red-400'
      }`}>
        {change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {Math.abs(change)}%
      </div>
    </div>
  </div>
);

const MetricBox = ({ label, value, icon }: any) => (
  <div className="bg-black/30 border border-white/10 rounded-lg p-4">
    <div className="flex items-center gap-2 text-gray-400 mb-2">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
);

const TrendItem = ({ label, value, total }: any) => {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  const isPositive = value > 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{total}</span>
        <div className={`flex items-center gap-1 font-semibold ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}>
          {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          <span>{Math.abs(value)} ({percentage}%)</span>
        </div>
      </div>
    </div>
  );
};

export default DJAnalytics;
