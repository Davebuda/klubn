import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../apollo-client';
import { CREATE_GALLERY_MEDIA, GET_EVENTS } from '../graphql/queries';
import { Upload, X, Image as ImageIcon, Video, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

type FilePreview = {
  file: File;
  preview: string;
  type: 'image' | 'video';
};

const UploadMediaPage = () => {
  const { isAuthenticated } = useAuth();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: eventsData } = useQuery(GET_EVENTS);
  const [createMedia] = useMutation(CREATE_GALLERY_MEDIA);

  const events = useMemo(() => eventsData?.events ?? [], [eventsData]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFiles = (fileList: File[]) => {
    const validFiles = fileList.filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    const newPreviews: FilePreview[] = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' : 'video',
    }));

    setFiles((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFile = async (file: File): Promise<string> => {
    const token = getAccessToken(); // P0-WS3B — in-memory token, not localStorage
    if (!token) throw new Error('You must be logged in to upload.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'gallery');

    try {
      const baseUrl = import.meta.env.VITE_UPLOAD_API_URL ?? 'http://localhost:5000/api/FileUpload/image';
      const mediaUrl = baseUrl.replace(/\/image$/, '/media');
      const headers = { Authorization: `Bearer ${token}` };
      const isVideo = file.type.startsWith('video/');

      let response = await fetch(mediaUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Fall back to /image endpoint if /media not available
      if ((response.status === 404 || response.status === 401) && mediaUrl !== baseUrl) {
        if (isVideo) throw new Error('Video uploads require a backend update. Please restart the backend.');
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
      return data.url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      setUploadStatus({ type: 'error', message: 'Please select at least one file to upload' });
      return;
    }

    if (!title.trim()) {
      setUploadStatus({ type: 'error', message: 'Please provide a title for your upload' });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      // Upload all files
      const uploadPromises = files.map((filePreview) => uploadFile(filePreview.file));
      const uploadedUrls = await Promise.all(uploadPromises);

      // Create media entries for each uploaded file
      const createPromises = uploadedUrls.map((url, index) =>
        createMedia({
          variables: {
            input: {
              title: files.length > 1 ? `${title} (${index + 1})` : title,
              description,
              mediaUrl: url,
              mediaType: files[index].type,
              thumbnailUrl: files[index].type === 'image' ? url : null,
              tags: tags || null,
              eventId: selectedEventId || null,
            },
          },
        })
      );

      await Promise.all(createPromises);

      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${files.length} ${files.length === 1 ? 'file' : 'files'}! Your media will be reviewed before appearing in the gallery.`,
      });

      // Reset form
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setTitle('');
      setDescription('');
      setSelectedEventId('');
      setTags('');
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload files. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <Upload className="w-16 h-16 text-orange-400 mx-auto" />
          <h1 className="text-3xl font-bold text-white">Please Login</h1>
          <p className="text-gray-400">Sign in to share your event moments with the community</p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold hover:from-orange-400 hover:to-pink-400 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0505] via-[#050202] to-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Share Your Moments</p>
          <h1 className="text-5xl font-bold">Upload Media</h1>
          <p className="text-gray-400 text-lg">
            Share photos and videos from events you've attended. Your uploads will be reviewed before going live.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Drag and Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`relative rounded-2xl border-2 border-dashed transition-all ${
              isDragging
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/20 bg-gradient-to-br from-zinc-900/70 to-black/80'
            }`}
          >
            <div className="p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center">
                  <Upload className="w-10 h-10 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Drop files here or click to browse</h3>
                <p className="text-gray-400">Support for images and videos up to 50MB</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Selected Files ({files.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((filePreview, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 overflow-hidden group"
                  >
                    <div className="aspect-square">
                      {filePreview.type === 'image' ? (
                        <img
                          src={filePreview.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video src={filePreview.preview} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/60 text-xs font-semibold flex items-center gap-1">
                      {filePreview.type === 'image' ? (
                        <ImageIcon className="w-3 h-3" />
                      ) : (
                        <Video className="w-3 h-3" />
                      )}
                      <span>{filePreview.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-black/80 p-6 space-y-6">
            <h3 className="text-xl font-bold">Details</h3>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none transition"
                placeholder="Give your upload a catchy title"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none transition"
                rows={4}
                placeholder="Describe the moment, the vibe, or the experience..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-300">
                  Event (Optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none transition appearance-none cursor-pointer"
                >
                  <option value="">Not associated with an event</option>
                  {events.map((event: any) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-300">
                  Tags (Optional)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-orange-500 focus:outline-none transition"
                  placeholder="techno, underground, festival"
                />
              </div>
            </div>
          </div>

          {/* Status Message */}
          {uploadStatus && (
            <div
              className={`rounded-xl px-6 py-4 flex items-center gap-3 ${
                uploadStatus.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
              )}
              <p>{uploadStatus.message}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="flex-1 px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-bold uppercase tracking-wider hover:from-orange-400 hover:to-pink-400 transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              <span>{uploading ? 'Uploading...' : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`}</span>
            </button>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  files.forEach((f) => URL.revokeObjectURL(f.preview));
                  setFiles([]);
                }}
                className="px-8 py-4 rounded-full border border-white/20 text-white font-semibold hover:border-orange-400 transition"
              >
                Clear All
              </button>
            )}
          </div>

          <p className="text-sm text-gray-400 text-center">
            Your uploads will be reviewed by our team before appearing in the gallery.
            Please ensure your content follows our community guidelines.
          </p>
        </form>
      </div>
    </div>
  );
};

export default UploadMediaPage;
