import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { SUBMIT_DJ_APPLICATION } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';

type DJApplicationFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const DJApplicationForm = ({ isOpen, onClose, onSuccess }: DJApplicationFormProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    stageName: '',
    bio: '',
    genre: '',
    yearsExperience: 0,
    specialties: '',
    influencedBy: '',
    equipmentUsed: '',
    socialLinks: '',
    profileImageUrl: '',
    coverImageUrl: '',
  });

  const [submitApplication, { loading, error }] = useMutation(SUBMIT_DJ_APPLICATION, {
    onCompleted: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert('You must be logged in to apply as a DJ');
      return;
    }

    try {
      await submitApplication({
        variables: {
          input: {
            userId: user.id,
            stageName: formData.stageName,
            bio: formData.bio,
            genre: formData.genre,
            yearsExperience: parseInt(formData.yearsExperience.toString()),
            specialties: formData.specialties || null,
            influencedBy: formData.influencedBy || null,
            equipmentUsed: formData.equipmentUsed || null,
            socialLinks: formData.socialLinks || null,
            profileImageUrl: formData.profileImageUrl || null,
            coverImageUrl: formData.coverImageUrl || null,
          },
        },
      });
    } catch (err) {
      console.error('Error submitting DJ application:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'yearsExperience' ? parseInt(value) || 0 : value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-zinc-900 via-zinc-900 to-black rounded-3xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-red-950/50 to-purple-950/50 backdrop-blur-md border-b border-white/10 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1 w-8 bg-gradient-to-r from-red-500 to-transparent rounded-full" />
                <p className="text-xs uppercase tracking-[0.4em] text-red-400 font-bold">Application</p>
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Apply as a DJ
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-900/50 text-red-300">
              <p className="font-semibold">Error submitting application</p>
              <p className="text-sm text-red-400 mt-1">{error.message}</p>
            </div>
          )}

          {/* Basic Info Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-red-500 to-transparent rounded-full" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                  Stage Name *
                </label>
                <input
                  type="text"
                  name="stageName"
                  value={formData.stageName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                  placeholder="DJ Shadow"
                />
              </div>

              <div>
                <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                  Genre *
                </label>
                <input
                  type="text"
                  name="genre"
                  value={formData.genre}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                  placeholder="Techno, House, Trance"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">Bio *</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
                placeholder="Tell us about your DJ journey and style..."
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Years of Experience *
              </label>
              <input
                type="number"
                name="yearsExperience"
                value={formData.yearsExperience}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="5"
              />
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-purple-500 to-transparent rounded-full" />
              Additional Details
            </h3>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Specialties
              </label>
              <input
                type="text"
                name="specialties"
                value={formData.specialties}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="Vinyl mixing, Live remixing, etc."
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Influenced By
              </label>
              <input
                type="text"
                name="influencedBy"
                value={formData.influencedBy}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="Carl Cox, Nina Kraviz, etc."
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Equipment Used
              </label>
              <input
                type="text"
                name="equipmentUsed"
                value={formData.equipmentUsed}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="CDJ-3000, DJM-900NXS2, etc."
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Social Links (JSON format)
              </label>
              <textarea
                name="socialLinks"
                value={formData.socialLinks}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all resize-none font-mono text-sm"
                placeholder='{"instagram": "djshadow", "soundcloud": "djshadow"}'
              />
            </div>
          </div>

          {/* Media URLs Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-[#FF6B35] to-transparent rounded-full" />
              Profile Media
            </h3>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Profile Image URL
              </label>
              <input
                type="url"
                name="profileImageUrl"
                value={formData.profileImageUrl}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="https://example.com/profile.jpg"
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold">
                Cover Image URL
              </label>
              <input
                type="url"
                name="coverImageUrl"
                value={formData.coverImageUrl}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="https://example.com/cover.jpg"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-xl font-bold text-sm tracking-wide bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-red-600 via-orange-600 to-purple-600 text-white hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DJApplicationForm;
