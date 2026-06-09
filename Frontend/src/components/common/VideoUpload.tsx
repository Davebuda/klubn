import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

interface VideoUploadProps {
  currentVideoUrl?: string;
  onVideoUploaded: (videoUrl: string) => void;
  folder?: string;
  label?: string;
  maxSizeMB?: number;
}

const VideoUpload = ({
  currentVideoUrl,
  onVideoUploaded,
  folder = 'general',
  label = 'Upload Video',
  maxSizeMB = 50,
}: VideoUploadProps) => {
  const { token, isAuthenticated } = useAuth();
  const [preview, setPreview] = useState<string | null>(currentVideoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== 'undefined') return localStorage.getItem('accessToken');
    return null;
  }, [token]);

  useEffect(() => {
    setPreview(currentVideoUrl || null);
  }, [currentVideoUrl]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    if (!resolvedToken) {
      setError(
        isAuthenticated
          ? 'Session expired. Please sign in again.'
          : 'You must be logged in to upload videos.',
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const uploadBase =
        import.meta.env.VITE_UPLOAD_API_URL?.replace('/image', '/media') ??
        'http://localhost:5000/api/FileUpload/media';

      const response = await fetch(uploadBase, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resolvedToken}` },
        body: formData,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'Upload failed');
      }

      const uploadedUrl = (data as { url: string }).url;
      onVideoUploaded(uploadedUrl);
      setPreview(uploadedUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onVideoUploaded('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">{label}</label>

      <div className="relative">
        <div
          className="relative w-full rounded-lg border-2 border-dashed border-gray-600 bg-gray-900 overflow-hidden cursor-pointer hover:border-orange-500 transition-colors group aspect-video"
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <>
              <video
                src={preview}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-sm font-medium">Click to change video</p>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Click to upload video</p>
              <p className="text-xs text-gray-500 mt-1">MP4, WebM, MOV up to {maxSizeMB}MB</p>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
                <p className="text-white text-sm mt-3">Uploading...</p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {preview && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default VideoUpload;
