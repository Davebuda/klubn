import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_GALLERY_MEDIA,
  UPDATE_GALLERY_MEDIA,
  DELETE_GALLERY_MEDIA,
} from '../../graphql/queries';

interface GalleryItem {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl: string;
  userId: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  uploadedAt: string;
  isApproved: boolean;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  tags: string[];
}

type FilterMode = 'all' | 'pending' | 'approved' | 'featured';

const AdminGalleryPage = () => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_GALLERY_MEDIA, {
    variables: { approvedOnly: false },
  });
  const [updateMedia] = useMutation(UPDATE_GALLERY_MEDIA);
  const [deleteMedia] = useMutation(DELETE_GALLERY_MEDIA);

  const allMedia: GalleryItem[] = useMemo(() => data?.galleryMedia ?? [], [data]);

  const filteredMedia = useMemo(() => {
    switch (filterMode) {
      case 'pending':
        return allMedia.filter((m) => !m.isApproved);
      case 'approved':
        return allMedia.filter((m) => m.isApproved && !m.isFeatured);
      case 'featured':
        return allMedia.filter((m) => m.isFeatured);
      default:
        return allMedia;
    }
  }, [allMedia, filterMode]);

  const stats = useMemo(() => ({
    total: allMedia.length,
    pending: allMedia.filter((m) => !m.isApproved).length,
    approved: allMedia.filter((m) => m.isApproved).length,
    featured: allMedia.filter((m) => m.isFeatured).length,
  }), [allMedia]);

  const handleApprove = async (id: string, approve: boolean) => {
    try {
      await updateMedia({ variables: { id, input: { isApproved: approve } } });
      await refetch();
      setFeedback({ type: 'success', text: approve ? 'Media approved.' : 'Approval revoked.' });
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update.' });
    }
  };

  const handleFeature = async (id: string, feature: boolean) => {
    try {
      await updateMedia({ variables: { id, input: { isFeatured: feature } } });
      await refetch();
      setFeedback({ type: 'success', text: feature ? 'Media featured.' : 'Removed from featured.' });
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media permanently?')) return;
    try {
      await deleteMedia({ variables: { id } });
      await refetch();
      setFeedback({ type: 'success', text: 'Media deleted.' });
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete.' });
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading gallery media...</div>;
  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        Failed to load gallery: {error.message}
      </div>
    );
  }

  const filterButtons: { label: string; mode: FilterMode; count: number }[] = [
    { label: 'All', mode: 'all', count: stats.total },
    { label: 'Pending', mode: 'pending', count: stats.pending },
    { label: 'Approved', mode: 'approved', count: stats.approved },
    { label: 'Featured', mode: 'featured', count: stats.featured },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Media Console</p>
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <p className="text-sm text-gray-400">
          Review user-uploaded media. Approve, feature, or remove content.
        </p>
      </header>

      {feedback && (
        <div
          className={`rounded px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Stats + filter row */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.mode}
            onClick={() => setFilterMode(btn.mode)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.25em] transition-all ${
              filterMode === btn.mode
                ? 'bg-white text-black font-semibold'
                : 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {btn.label}
            <span className="ml-2 opacity-60">{btn.count}</span>
          </button>
        ))}
      </div>

      {/* Media grid */}
      {filteredMedia.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          No media found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              className="card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-black/40">
                {item.mediaType === 'video' ? (
                  <video
                    src={item.mediaUrl}
                    poster={item.thumbnailUrl}
                    className="h-full w-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                )}
                {/* Status badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {!item.isApproved && (
                    <span className="rounded-full bg-yellow-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-black">
                      Pending
                    </span>
                  )}
                  {item.isFeatured && (
                    <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white">
                      Featured
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2 text-[0.6rem] uppercase tracking-wider text-white/60 bg-black/50 rounded-full px-2 py-0.5">
                  {item.mediaType}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold truncate">{item.title || 'Untitled'}</h3>
                  <p className="text-xs text-gray-500 truncate">
                    by {item.userName || 'Unknown'} {item.eventTitle ? `· ${item.eventTitle}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
                  <span>{item.viewCount} views</span>
                  <span>{item.likeCount} likes</span>
                  <span>{new Date(item.uploadedAt).toLocaleDateString()}</span>
                </div>

                {item.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {!item.isApproved ? (
                    <button
                      onClick={() => handleApprove(item.id, true)}
                      className="text-xs uppercase tracking-wide text-green-400 hover:text-green-300"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(item.id, false)}
                      className="text-xs uppercase tracking-wide text-yellow-400 hover:text-yellow-300"
                    >
                      Revoke
                    </button>
                  )}
                  {item.isApproved && (
                    <button
                      onClick={() => handleFeature(item.id, !item.isFeatured)}
                      className="text-xs uppercase tracking-wide text-orange-400 hover:text-orange-300"
                    >
                      {item.isFeatured ? 'Unfeature' : 'Feature'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs uppercase tracking-wide text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminGalleryPage;
