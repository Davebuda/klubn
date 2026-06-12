import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ORGANIZER_APPLICATIONS,
  APPROVE_ORGANIZER_APPLICATION,
  REJECT_ORGANIZER_APPLICATION,
} from '../../graphql/queries';
import { safeHttpUrl } from '../../lib/safeHttpUrl';

const AdminOrganizerApplicationsPage = () => {
  const { data, loading, refetch } = useQuery(GET_ORGANIZER_APPLICATIONS);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [approve, { loading: approving }] = useMutation(APPROVE_ORGANIZER_APPLICATION, {
    onCompleted: () => { refetch(); setFeedback('Application approved. User promoted to Event Organizer.'); },
  });
  const [reject, { loading: rejecting }] = useMutation(REJECT_ORGANIZER_APPLICATION, {
    onCompleted: () => { refetch(); setRejectingId(null); setReason(''); setFeedback('Application rejected.'); },
  });

  const applications = data?.organizerApplications ?? [];
  const pending = applications.filter((a: any) => a.status === 'Pending');
  const reviewed = applications.filter((a: any) => a.status !== 'Pending');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Organizer Applications</h1>
        <p className="text-sm text-gray-400 mt-1">Review and approve event organizer applications.</p>
      </header>

      {feedback && (
        <div className="rounded px-4 py-3 text-sm bg-green-500/10 border border-green-500/30 text-green-200">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-orange-400">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">No pending applications.</p>
            ) : pending.map((app: any) => (
              <div key={app.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">{app.organizationName}</p>
                    <p className="text-xs text-gray-400">User ID: {app.userId}</p>
                    <p className="text-xs text-gray-500">Submitted {new Date(app.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => approve({ variables: { applicationId: app.id } })}
                      disabled={approving}
                      className="rounded-full bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-green-500/30 transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(app.id)}
                      className="rounded-full bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-red-500/30 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{app.description}</p>
                {safeHttpUrl(app.website) && (
                  <a href={safeHttpUrl(app.website)} target="_blank" rel="noreferrer" className="text-xs text-orange-400 hover:underline">
                    {app.website}
                  </a>
                )}

                {/* Reject modal */}
                {rejectingId === app.id && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                    <p className="text-sm text-red-300 font-medium">Rejection reason (optional)</p>
                    <textarea
                      className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why this application is being rejected…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reject({ variables: { applicationId: app.id, rejectionReason: reason || null } })}
                        disabled={rejecting}
                        className="rounded-full bg-red-500 text-white px-5 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                      >
                        {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setReason(''); }}
                        className="rounded-full border border-white/20 text-gray-300 px-5 py-1.5 text-xs uppercase tracking-wide"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>

          {reviewed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                Previously Reviewed ({reviewed.length})
              </h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase tracking-wide">
                      <th className="py-2">Organization</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewed.map((app: any) => (
                      <tr key={app.id} className="border-t border-white/5">
                        <td className="py-2 text-white">{app.organizationName}</td>
                        <td className="py-2">
                          <span className={`text-xs font-semibold ${app.status === 'Approved' ? 'text-green-400' : 'text-red-400'}`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400 text-xs">
                          {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminOrganizerApplicationsPage;
