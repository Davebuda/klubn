import { FormEvent, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../apollo-client';
import {
  SUBMIT_DJ_APPLICATION,
  HAS_PENDING_DJ_APPLICATION,
  GET_DJ_APPLICATION_BY_USER,
  GET_GENRES,
} from '../graphql/queries';
import { Music, CheckCircle, Clock, XCircle } from 'lucide-react';

const DJEnrollPage = () => {
  const { user, isDJ } = useAuth();
  const navigate = useNavigate();

  // Check existing application status
  const { data: pendingData, loading: pendingLoading } = useQuery(HAS_PENDING_DJ_APPLICATION, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
  });

  const { data: applicationData } = useQuery(GET_DJ_APPLICATION_BY_USER, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
  });

  const { data: genresData } = useQuery(GET_GENRES);
  const genres: { id: string; name: string }[] = genresData?.genres ?? [];

  const [submitApplication, { loading: submitting }] = useMutation(SUBMIT_DJ_APPLICATION);

  // Form state
  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState(0);
  const [specialties, setSpecialties] = useState('');
  const [influencedBy, setInfluencedBy] = useState('');
  const [equipmentUsed, setEquipmentUsed] = useState('');
  const [socialLinks, setSocialLinks] = useState({ instagram: '', soundcloud: '', spotify: '' });
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleImageUpload = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const token = getAccessToken(); // P0-WS3B — in-memory token, not localStorage
    const uploadBase = import.meta.env.VITE_UPLOAD_API_URL ?? 'http://localhost:5000/api/FileUpload/image';
    const response = await fetch(uploadBase, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    const data = await response.json();
    return data.url;
  };

  const handleProfileImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    try {
      const url = await handleImageUpload(file, 'dj-applications');
      setProfileImageUrl(url);
    } catch {
      setError('Failed to upload profile image');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleCoverImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await handleImageUpload(file, 'dj-applications');
      setCoverImageUrl(url);
    } catch {
      setError('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };

  const toggleGenre = (name: string) => {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!stageName.trim()) {
      setError('Stage name is required');
      return;
    }
    if (!bio.trim()) {
      setError('Bio is required');
      return;
    }
    if (selectedGenres.length === 0) {
      setError('Select at least one genre');
      return;
    }

    try {
      await submitApplication({
        variables: {
          input: {
            userId: user!.id,
            stageName: stageName.trim(),
            bio: bio.trim(),
            genre: selectedGenres.join(', '),
            yearsExperience,
            specialties: specialties.trim() || null,
            influencedBy: influencedBy.trim() || null,
            equipmentUsed: equipmentUsed.trim() || null,
            socialLinks: JSON.stringify(socialLinks),
            profileImageUrl: profileImageUrl || null,
            coverImageUrl: coverImageUrl || null,
          },
        },
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application. Please try again.');
    }
  };

  if (pendingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    );
  }

  // Already a DJ
  if (isDJ) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">You're Already a DJ!</h1>
          <p className="text-gray-400">You have an active DJ profile. Head to your dashboard to manage it.</p>
          <button
            onClick={() => navigate('/dj-dashboard')}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold tracking-wide hover:shadow-[0_0_30px_rgba(255,107,53,0.4)] transition-all"
          >
            Go to DJ Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Existing application
  const existingApp = applicationData?.djApplicationByUser;
  const hasPending = pendingData?.hasPendingDjApplication;

  if (hasPending || existingApp?.status === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Application Under Review</h1>
          <p className="text-gray-400">
            Your DJ application as <span className="text-orange-400 font-semibold">{existingApp?.stageName}</span> is
            being reviewed by our team. We'll notify you once a decision is made.
          </p>
          <p className="text-xs text-gray-600">
            Submitted {existingApp?.submittedAt ? new Date(existingApp.submittedAt).toLocaleDateString() : 'recently'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-2xl border border-white/10 text-white hover:border-orange-400 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Rejected application
  if (existingApp?.status === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Application Not Approved</h1>
          <p className="text-gray-400">
            Unfortunately, your application wasn't approved at this time.
          </p>
          {existingApp.rejectionReason && (
            <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-4">
              <p className="text-sm text-red-300">{existingApp.rejectionReason}</p>
            </div>
          )}
          <p className="text-gray-500 text-sm">Feel free to reach out to us for more information.</p>
          <button
            onClick={() => navigate('/contact')}
            className="px-8 py-3 rounded-2xl border border-white/10 text-white hover:border-orange-400 transition-all"
          >
            Contact Us
          </button>
        </div>
      </div>
    );
  }

  // Just submitted
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Application Submitted!</h1>
          <p className="text-gray-400">
            Thanks for applying, <span className="text-orange-400 font-semibold">{stageName}</span>! Our team will review your
            application and get back to you soon.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold tracking-wide hover:shadow-[0_0_30px_rgba(255,107,53,0.4)] transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Enrollment form
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0505] via-[#050202] to-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-transparent rounded-full" />
            <p className="text-sm uppercase tracking-[0.6em] text-orange-400 font-bold">DJ Application</p>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black">
            Join the{' '}
            <span className="bg-gradient-to-r from-orange-500 via-[#FF6B35] to-red-500 bg-clip-text text-transparent">
              Lineup
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl">
            Show us what you bring to the decks. Fill out the form below and our team will review your application.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Stage Name */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500 font-bold">
              Stage Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              required
              placeholder="Your DJ name"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500 font-bold">
              Bio <span className="text-red-400">*</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              required
              rows={4}
              placeholder="Tell us about yourself, your style, and what drives your music..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all resize-none"
            />
          </div>

          {/* Genres */}
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500 font-bold">
              Genres <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => toggleGenre(genre.name)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    selectedGenres.includes(genre.name)
                      ? 'bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black border-orange-500'
                      : 'bg-black/40 text-gray-400 border-white/10 hover:border-orange-400/50 hover:text-white'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
              {genres.length === 0 && (
                <p className="text-gray-600 text-sm">Loading genres...</p>
              )}
            </div>
          </div>

          {/* Years Experience */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500 font-bold">
              Years of Experience
            </label>
            <input
              type="number"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
              min={0}
              max={50}
              className="w-full max-w-[200px] rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
            />
          </div>

          {/* Optional Fields */}
          <div className="space-y-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-600 font-bold">Optional Details</p>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-gray-500">Specialties</label>
              <input
                type="text"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="e.g., Live mixing, Turntablism, Production"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-gray-500">Influenced By</label>
              <input
                type="text"
                value={influencedBy}
                onChange={(e) => setInfluencedBy(e.target.value)}
                placeholder="Artists or DJs that inspire your sound"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-gray-500">Equipment Used</label>
              <input
                type="text"
                value={equipmentUsed}
                onChange={(e) => setEquipmentUsed(e.target.value)}
                placeholder="e.g., Pioneer CDJ-3000, DJM-900NXS2"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-600 font-bold">Social Links</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Instagram</label>
                <input
                  type="url"
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks((p) => ({ ...p, instagram: e.target.value }))}
                  placeholder="https://instagram.com/..."
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-orange-400 focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">SoundCloud</label>
                <input
                  type="url"
                  value={socialLinks.soundcloud}
                  onChange={(e) => setSocialLinks((p) => ({ ...p, soundcloud: e.target.value }))}
                  placeholder="https://soundcloud.com/..."
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-orange-400 focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Spotify</label>
                <input
                  type="url"
                  value={socialLinks.spotify}
                  onChange={(e) => setSocialLinks((p) => ({ ...p, spotify: e.target.value }))}
                  placeholder="https://open.spotify.com/..."
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-orange-400 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Image Uploads */}
          <div className="space-y-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-600 font-bold">Images</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Image */}
              <div className="space-y-3">
                <label className="text-xs text-gray-500">Profile Photo</label>
                <div className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-white/10 overflow-hidden bg-black/40 hover:border-orange-400/50 transition-all">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {uploadingProfile ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
                      ) : (
                        <Music className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImage}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-3">
                <label className="text-xs text-gray-500">Cover Image</label>
                <div className="relative w-full h-32 rounded-2xl border-2 border-dashed border-white/10 overflow-hidden bg-black/40 hover:border-orange-400/50 transition-all">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {uploadingCover ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
                      ) : (
                        <span className="text-gray-600 text-sm">Click to upload</span>
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImage}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-900/30 bg-red-950/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || uploadingProfile || uploadingCover}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B35] px-6 py-4 text-sm font-bold tracking-[0.3em] uppercase text-black hover:shadow-[0_0_40px_rgba(255,107,53,0.5)] hover:scale-[1.02] transition-all disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {submitting ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DJEnrollPage;
