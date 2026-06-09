import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS, UPDATE_USER_ROLE, DELETE_USER } from '../../graphql/queries';

type User = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: number;
  isEmailVerified: boolean;
  provider?: string | null;
  profilePictureUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};

const roleLabel = (role: number) => {
  switch (role) {
    case 2: return 'Admin';
    case 1: return 'DJ';
    case 3: return 'Organizer';
    case 4: return 'CoAdmin';
    default: return 'User';
  }
};

const roleBadgeClass = (role: number) => {
  switch (role) {
    case 2: return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 1: return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 3: return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
    case 4: return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const AdminUsersPage = () => {
  const { data, loading, error, refetch } = useQuery(GET_USERS);
  const users: User[] = useMemo(() => data?.users ?? [], [data]);
  const [updateUserRole] = useMutation(UPDATE_USER_ROLE);
  const [deleteUser] = useMutation(DELETE_USER);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{ userId: string; role: number } | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ userId: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleRoleChange = async (userId: string, newRole: number) => {
    setPendingRole({ userId, role: newRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    setRoleUpdating(true);
    try {
      await updateUserRole({ variables: { userId: pendingRole.userId, role: pendingRole.role } });
      await refetch();
    } catch (e) {
      alert('Failed to update role: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRoleUpdating(false);
      setPendingRole(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await deleteUser({ variables: { userId: pendingDelete.userId } });
      setExpandedId(null);
      await refetch();
    } catch (e) {
      alert('Failed to delete user: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, search, roleFilter]);

  if (loading) return <div className="text-sm text-gray-400">Loading users...</div>;
  if (error) return <div className="text-red-300">Failed to load users: {error.message}</div>;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Access Control</p>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-gray-400">
          {users.length} registered accounts. Click a row to see full details.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, email, or ID..."
          className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {([['all', 'All'], [0, 'Users'], [1, 'DJs'], [2, 'Admins'], [3, 'Organizers'], [4, 'CoAdmins']] as const).map(([val, label]) => (
            <button
              key={String(val)}
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                roleFilter === val
                  ? 'bg-orange-500 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setRoleFilter(val as number | 'all')}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-auto">
          Showing {filtered.length} of {users.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <>
                <tr
                  key={user.id}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${
                    expandedId === user.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                  }`}
                  onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.profilePictureUrl ? (
                        <img
                          src={user.profilePictureUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-white">{user.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider border ${roleBadgeClass(user.role)}`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isEmailVerified ? (
                      <span className="text-green-400 text-xs">Yes</span>
                    ) : (
                      <span className="text-yellow-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(user.lastLoginAt)}
                  </td>
                </tr>

                {/* Expanded details row */}
                {expandedId === user.id && (
                  <tr key={`${user.id}-details`} className="bg-white/[0.04]">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <DetailField label="User ID" value={user.id} mono />
                        <DetailField label="Full Name" value={user.fullName} />
                        <DetailField label="Email" value={user.email} />
                        <DetailField label="Role" value={`${roleLabel(user.role)} (${user.role})`} />
                        <DetailField label="Email Verified" value={user.isEmailVerified ? 'Yes' : 'No'} />
                        <DetailField label="Provider" value={user.provider || 'Email'} />
                        <DetailField
                          label="Password Hash"
                          value={user.passwordHash || '(empty)'}
                          mono
                          truncate
                        />
                        <DetailField label="Profile Picture" value={user.profilePictureUrl || '—'} truncate />
                        <DetailField label="Registered" value={formatDate(user.createdAt)} />
                        <DetailField label="Last Updated" value={formatDate(user.updatedAt)} />
                        <DetailField label="Last Login" value={formatDate(user.lastLoginAt)} />
                      </div>
                      <div className="mt-4 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">Change Role</p>
                          <select
                            className="rounded border border-white/10 bg-black/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            defaultValue={user.role}
                            onChange={(e) => handleRoleChange(user.id, Number(e.target.value))}
                          >
                            <option value={0}>User</option>
                            <option value={1}>DJ</option>
                            <option value={3}>Organizer</option>
                            <option value={4}>CoAdmin</option>
                            <option value={2}>Admin</option>
                          </select>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPendingDelete({ userId: user.id, name: user.fullName }); }}
                          className="px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400 transition"
                        >
                          Delete User
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  {search || roleFilter !== 'all'
                    ? 'No users match the current filters.'
                    : 'No registered users yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-red-500/20 bg-[#111] p-6 space-y-4 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-red-400">Delete User</h2>
            <p className="text-sm text-gray-400">
              Permanently delete <span className="text-white font-semibold">{pendingDelete.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg text-xs uppercase tracking-wider border border-white/10 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-xs uppercase tracking-wider bg-red-600 text-white font-semibold hover:bg-red-500 transition disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change confirmation dialog */}
      {pendingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-4 w-full max-w-sm">
            <h2 className="text-lg font-semibold">Confirm Role Change</h2>
            <p className="text-sm text-gray-400">
              Change this user's role to{' '}
              <span className="text-white font-semibold">{roleLabel(pendingRole.role)}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingRole(null)}
                className="px-4 py-2 rounded-lg text-xs uppercase tracking-wider border border-white/10 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={roleUpdating}
                className="px-4 py-2 rounded-lg text-xs uppercase tracking-wider bg-orange-500 text-black font-semibold hover:bg-orange-400 transition disabled:opacity-50"
              >
                {roleUpdating ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailField = ({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) => (
  <div className="space-y-0.5">
    <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">{label}</p>
    <p
      className={`text-gray-200 ${mono ? 'font-mono text-xs' : ''} ${truncate ? 'truncate' : ''}`}
      title={truncate ? value : undefined}
    >
      {value}
    </p>
  </div>
);

export default AdminUsersPage;
