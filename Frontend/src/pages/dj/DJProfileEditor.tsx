import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_DJS, GET_DJ_BY_ID, UPDATE_DJ, UPDATE_USER_PROFILE } from '../../graphql/queries';
import { Camera, Save, Music } from 'lucide-react';
import ImageUpload from '../../components/common/ImageUpload';

interface SocialLink {
  label: string;
  url: string;
}

type SocialPlatformKey = 'instagram' | 'soundCloud' | 'spotify' | 'youtube' | 'facebook' | 'twitter';

const SOCIAL_PLATFORMS = [
  { key: 'instagram' as const, label: 'Instagram', placeholder: 'https://www.instagram.com/yourhandle' },
  { key: 'soundCloud' as const, label: 'SoundCloud', placeholder: 'https://soundcloud.com/yourhandle' },
  { key: 'spotify' as const, label: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
  { key: 'youtube' as const, label: 'YouTube', placeholder: 'https://www.youtube.com/@yourchannel' },
  { key: 'facebook' as const, label: 'Facebook', placeholder: 'https://www.facebook.com/yourpage' },
  { key: 'twitter' as const, label: 'Twitter', placeholder: 'https://twitter.com/yourhandle' },
] as const;

const extractSocialUrl = (links: SocialLink[], label: string): string =>
  links?.find((l) => l.label?.toLowerCase() === label.toLowerCase())?.url ?? '';

const serializeSocialLinks = (socials: Record<SocialPlatformKey, string>): string => {
  const links = SOCIAL_PLATFORMS
    .map(({ label, key }) => ({ label, url: socials[key].trim() }))
    .filter((l) => l.url);
  return JSON.stringify(links);
};

const DJProfileEditor = () => {
  const { user, isDJ, updateUserLocal } = useAuth();
  const navigate = useNavigate();
  const [djId, setDjId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: djsData } = useQuery(GET_DJS);
  const { data: djData, loading: loadingDJ } = useQuery(GET_DJ_BY_ID, {
    variables: { id: djId },
    skip: !djId,
  });

  const [updateDJ] = useMutation(UPDATE_DJ, {
    refetchQueries: [{ query: GET_DJS }, { query: GET_DJ_BY_ID, variables: { id: djId } }],
  });
  const [updateUserProfile] = useMutation(UPDATE_USER_PROFILE);

  // Form state
  const [formData, setFormData] = useState({
    stageName: '',
    bio: '',
    longBio: '',
    tagline: '',
    genre: '',
    profilePictureUrl: '',
    coverImageUrl: '',
    specialties: '',
    achievements: '',
    yearsExperience: 0,
    influencedBy: '',
    equipmentUsed: '',
    topTracks: [] as string[],
    instagram: '',
    soundCloud: '',
    spotify: '',
    youtube: '',
    facebook: '',
    twitter: '',
  });

  useEffect(() => {
    if (!isDJ) {
      navigate('/');
      return;
    }

    // Find DJ profile for logged-in user
    if (djsData?.dJs) {
      const profile = djsData.dJs.find((dj: any) =>
        dj.userId === user?.id
      );
      if (profile) {
        setDjId(profile.id);
      }
    }
  }, [isDJ, navigate, djsData, user]);

  useEffect(() => {
    if (djData?.dj) {
      const dj = djData.dj;
      setFormData({
        stageName: dj.stageName || '',
        bio: dj.bio || '',
        longBio: dj.longBio || '',
        tagline: dj.tagline || '',
        genre: dj.genre || '',
        profilePictureUrl: dj.profilePictureUrl || '',
        coverImageUrl: dj.coverImageUrl || '',
        specialties: dj.specialties || '',
        achievements: dj.achievements || '',
        yearsExperience: dj.yearsExperience || 0,
        influencedBy: dj.influencedBy || '',
        equipmentUsed: dj.equipmentUsed || '',
        topTracks: dj.topTracks || [],
        instagram: extractSocialUrl(dj.socialLinks || [], 'Instagram'),
        soundCloud: extractSocialUrl(dj.socialLinks || [], 'SoundCloud'),
        spotify: extractSocialUrl(dj.socialLinks || [], 'Spotify'),
        youtube: extractSocialUrl(dj.socialLinks || [], 'YouTube'),
        facebook: extractSocialUrl(dj.socialLinks || [], 'Facebook'),
        twitter: extractSocialUrl(dj.socialLinks || [], 'Twitter'),
      });
    }
  }, [djData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!djId) return;

    setSaving(true);
    try {
      await updateDJ({
        variables: {
          id: djId,
          input: {
            stageName: formData.stageName,
            bio: formData.bio,
            longBio: formData.longBio,
            tagline: formData.tagline,
            genre: formData.genre,
            profilePictureUrl: formData.profilePictureUrl,
            coverImageUrl: formData.coverImageUrl,
            specialties: formData.specialties,
            achievements: formData.achievements,
            yearsExperience: parseInt(formData.yearsExperience.toString()) || 0,
            influencedBy: formData.influencedBy,
            equipmentUsed: formData.equipmentUsed,
            topTracks: formData.topTracks.filter(t => t.trim()),
            socialLinks: serializeSocialLinks({
              instagram: formData.instagram,
              soundCloud: formData.soundCloud,
              spotify: formData.spotify,
              youtube: formData.youtube,
              facebook: formData.facebook,
              twitter: formData.twitter,
            }),
          },
        },
      });

      // Sync DJ profile picture to user account picture
      if (formData.profilePictureUrl && user) {
        try {
          await updateUserProfile({
            variables: {
              input: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                profilePictureUrl: formData.profilePictureUrl,
              },
            },
          });
          updateUserLocal({ profilePictureUrl: formData.profilePictureUrl });
        } catch {
          // Non-critical — DJ profile saved even if user sync fails
        }
      }

      alert('Profile updated successfully!');
      navigate('/dj-dashboard');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingDJ) {
    return (
      <div className="p-8">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Edit DJ Profile</h1>
            <p className="text-gray-400">Customize your profile to showcase your unique sound</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dj-dashboard')}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Cover & Profile Images */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Profile Images
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cover Image (Hero Background)
              </label>
              <ImageUpload
                currentImageUrl={formData.coverImageUrl}
                onImageUploaded={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                folder="dj-covers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profile Picture
              </label>
              <ImageUpload
                currentImageUrl={formData.profilePictureUrl}
                onImageUploaded={(url) => setFormData(prev => ({ ...prev, profilePictureUrl: url }))}
                folder="dj-profiles"
              />
            </div>
          </section>

          {/* Basic Info */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stage Name *
              </label>
              <input
                type="text"
                value={formData.stageName}
                onChange={(e) => setFormData(prev => ({ ...prev, stageName: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tagline (Catchy one-liner)
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g., Bringing the underground to the main stage"
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Genre *
              </label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="e.g., Techno, House, Trance"
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                value={formData.yearsExperience}
                onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none"
                min="0"
              />
            </div>
          </section>

          {/* Bio */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Biography</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Short Bio (Card Display) *
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                rows={3}
                placeholder="A brief introduction shown on DJ cards..."
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Extended Bio (Profile Page)
              </label>
              <textarea
                value={formData.longBio}
                onChange={(e) => setFormData(prev => ({ ...prev, longBio: e.target.value }))}
                rows={6}
                placeholder="Your full story, musical journey, and what makes you unique..."
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>
          </section>

          {/* Creative DNA */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Creative DNA</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Specialties
              </label>
              <textarea
                value={formData.specialties}
                onChange={(e) => setFormData(prev => ({ ...prev, specialties: e.target.value }))}
                rows={2}
                placeholder="e.g., Live mixing, vinyl sets, production"
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Achievements
              </label>
              <textarea
                value={formData.achievements}
                onChange={(e) => setFormData(prev => ({ ...prev, achievements: e.target.value }))}
                rows={2}
                placeholder="Awards, notable gigs, releases..."
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Influenced By
              </label>
              <textarea
                value={formData.influencedBy}
                onChange={(e) => setFormData(prev => ({ ...prev, influencedBy: e.target.value }))}
                rows={2}
                placeholder="Artists and DJs who inspire you..."
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Equipment Used
              </label>
              <textarea
                value={formData.equipmentUsed}
                onChange={(e) => setFormData(prev => ({ ...prev, equipmentUsed: e.target.value }))}
                rows={2}
                placeholder="CDJs, mixers, controllers, software..."
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>
          </section>

          {/* Top Tracks — managed via Top 10 Manager */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Music className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-semibold text-white">Top Tracks</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Manage your Top 10 tracks with Spotify and SoundCloud links from the dedicated manager.
            </p>
            <Link
              to="/dj-dashboard/top10"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 font-semibold text-sm transition"
            >
              <Music className="w-4 h-4" />
              Go to Top 10 Manager
            </Link>
          </section>

          {/* Social Links */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Social Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                <label key={key} className="space-y-1 text-sm font-semibold text-gray-300">
                  {label}
                  <input
                    type="url"
                    value={formData[key]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none font-normal mt-1"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/dj-dashboard')}
              className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#FF6B35] to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white font-semibold transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DJProfileEditor;
