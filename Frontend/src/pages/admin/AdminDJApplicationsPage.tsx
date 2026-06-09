import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_PENDING_DJ_APPLICATIONS, APPROVE_DJ_APPLICATION, REJECT_DJ_APPLICATION } from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';

type DJApplication = {
  id: string;
  userId: string;
  stageName: string;
  bio: string;
  genre: string;
  yearsExperience: number;
  specialties?: string;
  influencedBy?: string;
  equipmentUsed?: string;
  socialLinks?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  status: number;
  submittedAt: string;
  userEmail?: string;
  userName?: string;
};

const AdminDJApplicationsPage = () => {
  const { user } = useAuth();
  const [selectedApplication, setSelectedApplication] = useState<DJApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_PENDING_DJ_APPLICATIONS);

  const [approveApplication, { loading: approving }] = useMutation(APPROVE_DJ_APPLICATION, {
    onCompleted: () => { refetch(); setSelectedApplication(null); },
  });

  const [rejectApplication, { loading: rejecting }] = useMutation(REJECT_DJ_APPLICATION, {
    onCompleted: () => {
      refetch();
      setSelectedApplication(null);
      setShowRejectModal(false);
      setRejectionReason('');
    },
  });

  const handleApprove = async (applicationId: string) => {
    if (!user?.id) return;
    try {
      await approveApplication({ variables: { applicationId, reviewedByAdminId: user.id } });
    } catch (err) {
      console.error('Error approving application:', err);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !user?.id) return;
    try {
      await rejectApplication({
        variables: { applicationId: selectedApplication.id, reviewedByAdminId: user.id, rejectionReason: rejectionReason || null },
      });
    } catch (err) {
      console.error('Error rejecting application:', err);
    }
  };

  const applications: DJApplication[] = data?.pendingDjApplications || [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">DJ Applications</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review and approve DJ applications.{' '}
          <span className="text-white font-medium">{applications.length} pending.</span>
        </p>
      </header>

      {loading && <p className="text-sm text-gray-400">Loading applications…</p>}
      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      {!loading && applications.length === 0 && (
        <div className="card text-center py-12 text-gray-500 text-sm">
          No pending applications. Check back later.
        </div>
      )}

      <div className="space-y-6">
        {applications.map((app) => (
          <div key={app.id} className="card space-y-4">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Avatar */}
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                {app.profileImageUrl ? (
                  <img src={app.profileImageUrl} alt={app.stageName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-black text-gray-600">
                    {app.stageName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h2 className="text-xl font-bold text-white">{app.stageName}</h2>
                  <p className="text-xs text-gray-500">{app.userName} · {app.userEmail}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Submitted {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {app.genre.split(',').map((g, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/20">
                      {g.trim()}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold bg-white/5 text-gray-400 border border-white/10">
                    {app.yearsExperience} yrs exp.
                  </span>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed">{app.bio}</p>

                {(app.specialties || app.influencedBy || app.equipmentUsed) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {app.specialties && (
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-gray-500 mb-0.5">Specialties</p>
                        <p className="text-xs text-gray-400">{app.specialties}</p>
                      </div>
                    )}
                    {app.influencedBy && (
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-gray-500 mb-0.5">Influenced By</p>
                        <p className="text-xs text-gray-400">{app.influencedBy}</p>
                      </div>
                    )}
                    {app.equipmentUsed && (
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-gray-500 mb-0.5">Equipment</p>
                        <p className="text-xs text-gray-400">{app.equipmentUsed}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-white/5">
              <button
                onClick={() => handleApprove(app.id)}
                disabled={approving}
                className="rounded-full bg-green-500/20 border border-green-500/30 text-green-400 px-5 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-green-500/30 transition disabled:opacity-50"
              >
                {approving ? 'Approving…' : '✓ Approve'}
              </button>
              <button
                onClick={() => { setSelectedApplication(app); setShowRejectModal(true); }}
                className="rounded-full bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-red-500/20 transition"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reject modal */}
      {showRejectModal && selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-8 space-y-4">
            <h2 className="text-xl font-bold text-red-400">Reject Application</h2>
            <p className="text-sm text-gray-400">
              Rejecting <span className="text-white font-semibold">{selectedApplication.stageName}</span>
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none transition resize-none"
              placeholder="Reason for rejection (optional)…"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); setSelectedApplication(null); }}
                className="flex-1 rounded-full border border-white/20 text-gray-300 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 rounded-full bg-red-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wide hover:bg-red-500 transition disabled:opacity-50"
              >
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDJApplicationsPage;
