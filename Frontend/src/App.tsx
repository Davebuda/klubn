import { Route, Routes } from 'react-router-dom';
import Layout from './components/common/Layout';
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import DJsPage from './pages/DJsPage';
import DJProfilePage from './pages/DJProfilePage';
import ContactPage from './pages/ContactPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import OrdersPage from './pages/OrdersPage';
import UploadMediaPage from './pages/UploadMediaPage';
import GamificationPage from './pages/GamificationPage';
import GalleryPage from './pages/GalleryPage';
import PlaylistDiscoveryPage from './pages/PlaylistDiscoveryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import EditDJProfilePage from './pages/EditDJProfilePage';
import DJEnrollPage from './pages/DJEnrollPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import PortalRoute from './components/auth/PortalRoute';
import PortalLayout from './components/admin/PortalLayout';
import PortalDashboardPage from './pages/portal/PortalDashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import AdminVenuesPage from './pages/admin/AdminVenuesPage';
import AdminDJsPage from './pages/admin/AdminDJsPage';
import AdminPlaylistsPage from './pages/admin/AdminPlaylistsPage';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminSiteSettingsPage from './pages/admin/AdminSiteSettingsPage';
import AdminGalleryPage from './pages/admin/AdminGalleryPage';
import AdminHighlightsPage from './pages/admin/AdminHighlightsPage';
import AdminGenresPage from './pages/admin/AdminGenresPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminNewsletterPage from './pages/admin/AdminNewsletterPage';
import AdminContentPage from './pages/admin/AdminContentPage';
import AdminDJApplicationsPage from './pages/admin/AdminDJApplicationsPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminOrganizerApplicationsPage from './pages/admin/AdminOrganizerApplicationsPage';
import AdminPendingEventsPage from './pages/admin/AdminPendingEventsPage';
import DJRoute from './components/auth/DJRoute';
import DJLayout from './components/dj/DJLayout';
import DJDashboard from './pages/dj/DJDashboard';
import DJProfileEditor from './pages/dj/DJProfileEditor';
import DJTop10Manager from './pages/dj/DJTop10Manager';
import DJEventsList from './pages/dj/DJEventsList';
import DJAnalytics from './pages/dj/DJAnalytics';
import DJPlaylistsManager from './pages/dj/DJPlaylistsManager';
import DJMixesManager from './pages/dj/DJMixesManager';
import MixesPage from './pages/MixesPage';
import AdminMixesPage from './pages/admin/AdminMixesPage';
import EventTicketsPage from './pages/EventTicketsPage';
import CheckoutReturnPage from './pages/CheckoutReturnPage';
import OrganizerLayout from './components/layouts/OrganizerLayout';
import OrganizerApplyPage from './pages/organizer/OrganizerApplyPage';
import OrganizerDashboard from './pages/organizer/OrganizerDashboard';
import OrganizerEventsList from './pages/organizer/OrganizerEventsList';
import OrganizerEventForm from './pages/organizer/OrganizerEventForm';
const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<LandingPage />} />
      <Route path="events" element={<EventsPage />} />
      <Route path="events/:id" element={<EventDetailPage />} />
      <Route path="events/:id/tickets" element={<EventTicketsPage />} />
      <Route path="checkout/return" element={<CheckoutReturnPage />} />
      <Route path="djs" element={<DJsPage />} />
      <Route path="djs/:id" element={<DJProfilePage />} />
      <Route
        path="djs/edit/:id"
        element={
          <ProtectedRoute>
            <EditDJProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="contact" element={<ContactPage />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="tickets"
        element={
          <ProtectedRoute>
            <TicketsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="orders"
        element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="upload"
        element={
          <ProtectedRoute>
            <UploadMediaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="dj-enroll"
        element={
          <ProtectedRoute>
            <DJEnrollPage />
          </ProtectedRoute>
        }
      />
      <Route path="gallery" element={<GalleryPage />} />
      <Route path="playlists" element={<PlaylistDiscoveryPage />} />
      <Route path="mixes" element={<MixesPage />} />
      <Route path="gamification" element={<GamificationPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route
        path="organizer-apply"
        element={
          <ProtectedRoute>
            <OrganizerApplyPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route path="/organizer-dashboard" element={<OrganizerLayout />}>
      <Route index element={<OrganizerDashboard />} />
      <Route path="events" element={<OrganizerEventsList />} />
      <Route path="events/new" element={<OrganizerEventForm />} />
      <Route path="events/:id/edit" element={<OrganizerEventForm />} />
    </Route>

    <Route
      path="/dj-dashboard"
      element={
        <DJRoute>
          <DJLayout />
        </DJRoute>
      }
    >
      <Route index element={<DJDashboard />} />
      <Route path="edit-profile" element={<DJProfileEditor />} />
      <Route path="top10" element={<DJTop10Manager />} />
      <Route path="playlists" element={<DJPlaylistsManager />} />
      <Route path="mixes" element={<DJMixesManager />} />
      <Route path="events" element={<DJEventsList />} />
      <Route path="stats" element={<DJAnalytics />} />
    </Route>

    <Route
      path="/admin"
      element={
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      }
    >
      <Route index element={<AdminDashboardPage />} />
      <Route path="events" element={<AdminEventsPage />} />
      <Route path="venues" element={<AdminVenuesPage />} />
      <Route path="djs" element={<AdminDJsPage />} />
      <Route path="dj-applications" element={<AdminDJApplicationsPage />} />
      <Route path="tickets" element={<AdminTicketsPage />} />
      <Route path="playlists" element={<AdminPlaylistsPage />} />
      <Route path="mixes" element={<AdminMixesPage />} />
      <Route path="gallery" element={<AdminGalleryPage />} />
      <Route path="highlights" element={<AdminHighlightsPage />} />
      <Route path="genres" element={<AdminGenresPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="newsletter" element={<AdminNewsletterPage />} />
      <Route path="content" element={<AdminContentPage />} />
      <Route path="site-settings" element={<AdminSiteSettingsPage />} />
      <Route path="organizer-applications" element={<AdminOrganizerApplicationsPage />} />
      <Route path="pending-events" element={<AdminPendingEventsPage />} />
    </Route>

    <Route
      path="/portal"
      element={
        <PortalRoute>
          <PortalLayout />
        </PortalRoute>
      }
    >
      <Route index element={<PortalDashboardPage />} />
      <Route path="djs" element={<AdminDJsPage />} />
      <Route path="dj-applications" element={<AdminDJApplicationsPage />} />
      <Route path="events" element={<AdminEventsPage />} />
      <Route path="pending-events" element={<AdminPendingEventsPage />} />
      <Route path="tickets" element={<AdminTicketsPage />} />
      <Route path="mixes" element={<AdminMixesPage />} />
      <Route path="playlists" element={<AdminPlaylistsPage />} />
      <Route path="gallery" element={<AdminGalleryPage />} />
      <Route path="highlights" element={<AdminHighlightsPage />} />
      <Route path="venues" element={<AdminVenuesPage />} />
    </Route>
  </Routes>
);

export default App;
