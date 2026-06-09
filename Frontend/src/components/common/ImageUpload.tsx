import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  folder?: string;
  label?: string;
  aspectRatio?: string;
  maxSizeMB?: number;
}

const ImageUpload = ({
  currentImageUrl,
  onImageUploaded,
  folder = 'general',
  label = 'Upload Image',
  aspectRatio = 'aspect-video',
  maxSizeMB = 5,
}: ImageUploadProps) => {
  const { token, isAuthenticated } = useAuth();
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedToken = useMemo(() => {
    if (token) {
      return token;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }, [token]);

  useEffect(() => {
    setPreview(currentImageUrl || null);
  }, [currentImageUrl]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    if (!resolvedToken) {
      setError(
        isAuthenticated
          ? 'Session expired. Please sign in again to upload images.'
          : 'You must be logged in as an admin to upload images.',
      );
      setPreview(currentImageUrl || null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setError(null);

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadFile(file, resolvedToken);
  };

  const parseResponseBody = async (response: Response) => {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };

  const uploadFile = async (file: File, authToken: string) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`,
      };

      const uploadBase = import.meta.env.VITE_UPLOAD_API_URL ?? 'http://localhost:5000/api/FileUpload/image';
      const response = await fetch(uploadBase, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await parseResponseBody(response);

      if (!response.ok) {
        const apiError = (data as { error?: string } | null)?.error;
        const unauthorizedMessage =
          response.status === 401
            ? 'Unauthorized. Please ensure you are logged in with an admin account.'
            : null;
        const errorMessage = unauthorizedMessage || apiError || response.statusText || 'Upload failed';
        throw new Error(errorMessage);
      }

      if (!data || typeof (data as { url?: string }).url !== 'string') {
        throw new Error('Upload succeeded but no URL was returned.');
      }

      const uploadedUrl = (data as { url: string }).url;
      onImageUploaded(uploadedUrl);
      setPreview(uploadedUrl);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(currentImageUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">{label}</label>

      <div className="relative">
        {/* Preview Area */}
        <div
          className={`relative ${aspectRatio} w-full rounded-lg border-2 border-dashed border-gray-600 bg-gray-900 overflow-hidden cursor-pointer hover:border-orange-500 transition-colors group`}
          onClick={handleClick}
        >
          {preview ? (
            <>
              <img
                src={preview}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-sm font-medium">Click to change image</p>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <svg
                className="w-12 h-12 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Click to upload image</p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to {maxSizeMB}MB</p>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
                <p className="text-white text-sm mt-3">Uploading...</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Remove Button */}
        {preview && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
