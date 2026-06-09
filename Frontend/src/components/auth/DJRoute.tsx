import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface DJRouteProps {
  children: React.ReactNode;
}

const DJRoute = ({ children }: DJRouteProps) => {
  const { isDJ, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#140603] via-[#050202] to-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isDJ) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default DJRoute;
