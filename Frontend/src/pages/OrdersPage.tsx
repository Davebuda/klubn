import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_USER_TICKETS } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { Package, Calendar, CreditCard, Download, Search, Filter } from 'lucide-react';

type Order = {
  id: string;
  ticketNumber: string;
  price: number;
  purchaseDate: string;
  isCheckedIn: boolean;
  event: {
    id: string;
    title: string;
    date: string;
    venueName: string;
    city: string;
    imageUrl?: string;
  };
};

const OrdersPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'price-desc' | 'price-asc'>('date-desc');

  const { data, loading, error } = useQuery(GET_USER_TICKETS, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    fetchPolicy: 'cache-and-network',
  });

  const orders: Order[] = data?.ticketsByUser ?? [];

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter((order) => {
      // Search filter
      const matchesSearch =
        order.event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.event.venueName.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const eventDate = new Date(order.event.date);
      const isPast = eventDate < new Date();
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'upcoming' && !isPast) ||
        (statusFilter === 'past' && isPast);

      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        case 'date-asc':
          return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        case 'price-desc':
          return b.price - a.price;
        case 'price-asc':
          return a.price - b.price;
        default:
          return 0;
      }
    });

    return filtered;
  }, [orders, searchQuery, statusFilter, sortBy]);

  const totalSpent = useMemo(() => {
    return orders.reduce((sum, order) => sum + order.price, 0);
  }, [orders]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <Package className="w-16 h-16 text-orange-400 mx-auto" />
          <h1 className="text-3xl font-bold text-white">Please Login</h1>
          <p className="text-gray-400">Sign in to view your order history</p>
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
        <p className="text-orange-400 text-lg">Unable to load orders</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Purchase History</p>
          <h1 className="text-5xl font-bold">My Orders</h1>
          <p className="text-gray-400 text-lg">View and manage all your ticket purchases</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">{orders.length}</p>
                <p className="text-sm text-gray-400">Total Orders</p>
              </div>
            </div>
          </div>

          <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {orders.filter((o) => new Date(o.event.date) > new Date()).length}
                </p>
                <p className="text-sm text-gray-400">Upcoming Events</p>
              </div>
            </div>
          </div>

          <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">kr {totalSpent.toFixed(0)}</p>
                <p className="text-sm text-gray-400">Total Spent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by event, venue, or ticket number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-full bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:border-orange-400 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm uppercase tracking-[0.4em] text-gray-400 mb-3">
                <Filter className="w-4 h-4 inline mr-2" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-6 py-4 rounded-full bg-black/50 border border-white/20 text-white focus:border-orange-400 focus:outline-none transition appearance-none cursor-pointer"
              >
                <option value="all">All Orders</option>
                <option value="upcoming">Upcoming Events</option>
                <option value="past">Past Events</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm uppercase tracking-[0.4em] text-gray-400 mb-3">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-6 py-4 rounded-full bg-black/50 border border-white/20 text-white focus:border-orange-400 focus:outline-none transition appearance-none cursor-pointer"
              >
                <option value="date-desc">Purchase Date (Newest First)</option>
                <option value="date-asc">Purchase Date (Oldest First)</option>
                <option value="price-desc">Price (High to Low)</option>
                <option value="price-asc">Price (Low to High)</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              {(searchQuery || statusFilter !== 'all' || sortBy !== 'date-desc') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setSortBy('date-desc');
                  }}
                  className="w-full px-6 py-4 rounded-full border border-white/30 text-white text-sm hover:border-orange-400 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Package className="w-16 h-16 text-gray-600 mx-auto" />
            <p className="text-2xl font-semibold text-gray-400">No orders found</p>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
            {orders.length === 0 && (
              <Link
                to="/events"
                className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold hover:from-orange-400 hover:to-pink-400 transition-all"
              >
                Browse Events
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const eventDate = new Date(order.event.date);
              const isPast = eventDate < new Date();

              return (
                <div
                  key={order.id}
                  className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-orange-500/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6 p-6">
                    {/* Event Image */}
                    <div className="relative w-full md:w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden">
                      <img
                        src={order.event.imageUrl || '/media/defaults/event.jpg'}
                        alt={order.event.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span
                        className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${
                          isPast
                            ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}
                      >
                        {isPast ? 'Past' : 'Upcoming'}
                      </span>
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-2xl font-bold text-white hover:text-orange-400 transition-colors">
                              <Link to={`/events/${order.event.id}`}>{order.event.title}</Link>
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">
                              {eventDate.toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {order.event.venueName}
                              {order.event.city ? `, ${order.event.city}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500">Order ID</p>
                            <p className="font-mono text-white">{order.ticketNumber}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500">Purchase Date</p>
                            <p className="text-white">
                              {new Date(order.purchaseDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500">Status</p>
                            <p className="text-white">{order.isCheckedIn ? 'Attended' : isPast ? 'Expired' : 'Active'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Total Paid</p>
                          <p className="text-3xl font-bold text-orange-400">kr {order.price.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-3">
                          <Link
                            to={`/events/${order.event.id}`}
                            className="px-5 py-2 rounded-full border border-white/20 text-sm font-semibold hover:border-orange-400 transition"
                          >
                            View Event
                          </Link>
                          <button
                            className="px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black text-sm font-semibold hover:from-orange-400 hover:to-pink-400 transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Ticket</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
