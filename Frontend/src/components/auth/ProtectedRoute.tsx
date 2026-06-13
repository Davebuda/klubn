import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Carry the attempted path so /login can return the user here after sign-in
    // (e.g. a just-paid buyer bounced from /tickets before auth re-hydrated).
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
