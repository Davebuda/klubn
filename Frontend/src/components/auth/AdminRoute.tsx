import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: ReactNode;
}

const AdminRoute = ({ children }: Props) => {
  const { loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-orange-400">Access denied</p>
          <p className="text-gray-400">You need admin privileges to view this area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
