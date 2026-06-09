import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import ErrorBoundary from './ErrorBoundary';
import { BackgroundEffects } from '../effects/BackgroundEffects';
import { FloatingParticles } from '../effects/FloatingParticles';

const HIDE_FOOTER_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

const Layout = () => {
  const { pathname } = useLocation();
  const showFooter = !HIDE_FOOTER_ROUTES.includes(pathname);

  return (
    <div className="noise-overlay min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[#09090b] text-white font-body">
      <BackgroundEffects />
      <FloatingParticles />
      <Header />
      <main className="relative z-10 flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;
