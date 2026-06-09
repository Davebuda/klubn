import { Link } from 'react-router-dom';
import { Home, Calendar, Music, ChevronLeft } from 'lucide-react';

const NotFoundPage = () => (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-16">
    {/* Ambient background */}
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,53,0.06),transparent_55%)]" />
    </div>

    <div className="relative space-y-6 max-w-lg">
      <p className="text-[120px] sm:text-[160px] font-black leading-none bg-gradient-to-b from-orange-400/20 to-transparent bg-clip-text text-transparent select-none">
        404
      </p>

      <div className="space-y-3 -mt-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Page not found</h1>
        <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
          The route you're looking for doesn't exist or has been moved. Let's get you back to the dance floor.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-white font-bold text-sm hover:shadow-[0_0_25px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
        <Link
          to="/events"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 bg-white/5 text-white text-sm font-semibold hover:border-orange-400/40 transition"
        >
          <Calendar className="w-4 h-4" />
          Browse Events
        </Link>
      </div>

      <div className="pt-8 border-t border-white/10 mt-8">
        <p className="text-[0.65rem] uppercase tracking-[0.4em] text-gray-600 mb-4">Or try these</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { label: 'DJs', to: '/djs', icon: Music },
            { label: 'Gallery', to: '/gallery', icon: ChevronLeft },
            { label: 'Contact', to: '/contact', icon: ChevronLeft },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="px-4 py-2 rounded-full border border-white/10 text-xs text-gray-400 hover:text-orange-400 hover:border-orange-400/30 transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default NotFoundPage;
