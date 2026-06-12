import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_GALLERY_MEDIA, CREATE_GALLERY_MEDIA, LIKE_GALLERY_MEDIA } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import PageSeo from '../components/common/PageSeo';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Heart, Eye, Upload, Play } from 'lucide-react';

interface GalleryMedia {
  id: string;
  title: string;
  description?: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string;
  userName?: string;
  eventTitle?: string;
  uploadedAt: string;
  viewCount: number;
  likeCount: number;
  tags?: string;
}

const GalleryPage = () => {
  const { user } = useAuth();
  const { siteSettings } = useSiteSettings();
  const [selectedMedia, setSelectedMedia] = useState<GalleryMedia | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data, loading, refetch } = useQuery(GET_GALLERY_MEDIA, {
    variables: { approvedOnly: true },
  });

  const [likeMedia] = useMutation(LIKE_GALLERY_MEDIA, {
    onCompleted: () => refetch(),
  });

  const handleLike = async (id: string) => {
    if (!user) {
      alert('Please login to like media');
      return;
    }
    try {
      await likeMedia({ variables: { id } });
    } catch (error) {
      console.error('Error liking media:', error);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Gallery — KlubN Nights in Photos & Video"
        description="Browse photos and videos from KlubN events in Oslo. See the energy, the crowd, and the DJs that make the nights unforgettable."
        canonical="/gallery"
      />
      {/* Hero Section with Video */}
      <section className="relative min-h-[50vh] sm:min-h-[60vh] overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={siteSettings.galleryVideoUrl || '/media/sections/gallery/last 04.10.klubn.mp4'} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />

        <div className="relative z-10 h-full min-h-[50vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
            <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">The Experience</p>
            <div className="h-1 w-10 bg-gradient-to-l from-orange-400 to-transparent rounded-full" />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-[0.15em] sm:tracking-[0.3em] text-white mb-4">
            Gallery
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
            Relive the energy, the lights, and the unforgettable moments
          </p>

          {user && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 to-[#FF6B35] rounded-full font-bold uppercase tracking-wider hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] hover:scale-105 transition-all text-sm"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5" />
                <span>Upload Your Moment</span>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
          </div>
        ) : data?.galleryMedia?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.galleryMedia.map((media: GalleryMedia) => (
              <div
                key={media.id}
                className="liquid-glass group relative rounded-3xl overflow-hidden border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl hover:border-orange-500/40 transition-all cursor-pointer"
                onClick={() => setSelectedMedia(media)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square overflow-hidden">
                  {media.mediaType === 'video' ? (
                    <div className="relative w-full h-full">
                      <video
                        src={media.mediaUrl}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                        <Play className="w-16 h-16 text-white opacity-80" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={media.thumbnailUrl || media.mediaUrl}
                      alt={media.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                </div>

                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-bold text-lg mb-1 truncate">{media.title}</h3>
                  {media.userName && (
                    <p className="text-sm text-gray-300 mb-2">by {media.userName}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(media.id);
                      }}
                      className="flex items-center gap-1 hover:text-orange-400 transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                      <span>{media.likeCount}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{media.viewCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-xl text-gray-400">No media uploaded yet.</p>
            {user && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-6 px-8 py-3 bg-gradient-to-r from-orange-500 to-[#FF6B35] rounded-full font-bold uppercase tracking-wider hover:shadow-[0_0_25px_rgba(255,107,53,0.5)] hover:scale-105 transition-all"
              >
                Be the First to Share
              </button>
            )}
          </div>
        )}
      </section>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMedia.mediaType === 'video' ? (
              <video
                src={selectedMedia.mediaUrl}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            ) : (
              <img
                src={selectedMedia.mediaUrl}
                alt={selectedMedia.title}
                className="w-full rounded-lg"
              />
            )}

            <div className="mt-4 text-white">
              <h2 className="text-2xl font-bold mb-2">{selectedMedia.title}</h2>
              {selectedMedia.description && (
                <p className="text-gray-300 mb-4">{selectedMedia.description}</p>
              )}
              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleLike(selectedMedia.id)}
                  className="flex items-center gap-2 text-orange-400 hover:text-orange-300"
                >
                  <Heart className="w-5 h-5" />
                  <span>{selectedMedia.likeCount} likes</span>
                </button>
                <div className="flex items-center gap-2 text-gray-400">
                  <Eye className="w-5 h-5" />
                  <span>{selectedMedia.viewCount} views</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadMomentModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

// Upload Moment Modal Component
interface UploadMomentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const UploadMomentModal = ({ onClose, onSuccess }: UploadMomentModalProps) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [createMedia] = useMutation(CREATE_GALLERY_MEDIA, {
    onCompleted: () => {
      onSuccess();
    },
    onError: (error) => {
      console.error('Error creating media:', error);
      setUploadError('Failed to save media. Please try again.');
      setUploading(false);
    },
  });

  const handleFileUpload = async (file: File, isMain: boolean) => {
    setUploadError(null);

    // Validate file size (50MB for video, 5MB for images)
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`File size exceeds ${isVideo ? '50MB' : '5MB'} limit.`);
      return;
    }

    const authToken = token; // P0-WS3B — in-memory token, not localStorage
    if (!authToken) {
      setUploadError('You must be logged in to upload. Please sign in again.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'gallery');

    try {
      if (isMain) setFileUploading(true);
      const baseUrl = import.meta.env.VITE_UPLOAD_API_URL ?? 'http://localhost:5000/api/FileUpload/image';
      // Try /media endpoint first (supports images + videos), fall back to /image
      const mediaUrl = baseUrl.replace(/\/image$/, '/media');
      const headers = { Authorization: `Bearer ${authToken}` };

      let response = await fetch(mediaUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      // If /media endpoint not found (404) or unauthorized, fall back to /image
      if ((response.status === 404 || response.status === 401) && mediaUrl !== baseUrl) {
        if (isVideo) {
          throw new Error('Video uploads require a backend update. Please restart the backend server.');
        }
        response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      if (isMain) {
        setMediaUrl(data.url);
      } else {
        setThumbnailUrl(data.url);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      if (isMain) setFileUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    if (!title || !mediaUrl) {
      setUploadError('Please provide a title and upload a file');
      return;
    }

    setUploading(true);
    try {
      await createMedia({
        variables: {
          input: {
            title,
            description,
            mediaUrl,
            mediaType,
            thumbnailUrl: thumbnailUrl || null,
            tags: null,
            eventId: null,
          },
        },
      });
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="liquid-glass relative max-w-2xl w-full rounded-[32px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-xl p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-3xl font-bold uppercase tracking-wider mb-6 text-white">
          Upload Your Moment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              placeholder="Give your moment a title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-orange-500 focus:outline-none resize-none"
              rows={3}
              placeholder="Describe the moment..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Media Type
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Upload {mediaType === 'image' ? 'Image' : 'Video'} *
            </label>
            <input
              type="file"
              accept={mediaType === 'image' ? 'image/*' : 'video/*'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, true);
              }}
              disabled={fileUploading}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-orange-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600 disabled:opacity-50"
            />
            {fileUploading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-orange-300">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
                Uploading file...
              </div>
            )}
            {mediaUrl && !fileUploading && (
              <p className="mt-2 text-sm text-green-400">File uploaded successfully!</p>
            )}
          </div>

          {mediaType === 'video' && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Thumbnail (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, false);
                }}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-orange-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-orange-500/50 file:text-white file:cursor-pointer hover:file:bg-orange-500"
              />
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg px-4 py-3 text-sm bg-red-500/10 border border-red-500/40 text-red-200">
              {uploadError}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={uploading || fileUploading || !mediaUrl}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-[#FF6B35] rounded-full font-bold uppercase tracking-wider hover:shadow-[0_0_25px_rgba(255,107,53,0.5)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Saving...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/10 rounded-full font-bold uppercase tracking-wider hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm text-gray-400 text-center">
            Your upload will be reviewed before appearing in the gallery
          </p>
        </form>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default GalleryPage;
