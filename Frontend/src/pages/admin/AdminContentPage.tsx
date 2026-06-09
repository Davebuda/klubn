import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_SITE_SETTINGS } from '../../graphql/queries';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import VideoUpload from '../../components/common/VideoUpload';

type ContentTab = 'landing' | 'about' | 'faq' | 'terms';

const AdminContentPage = () => {
  const inputClass =
    'w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
  const textareaClass = `${inputClass} min-h-[120px]`;

  const { siteSettings, loading, refetch } = useSiteSettings();
  const [updateSettings, { loading: saving }] = useMutation(UPDATE_SITE_SETTINGS);

  const [activeTab, setActiveTab] = useState<ContentTab>('landing');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Landing page content fields (stored in site settings)
  const [landingForm, setLandingForm] = useState({
    heroGenres: '',
    heroLocation: '',
    heroVibes: '',
    brandHeadline: '',
    brandNarrative: '',
    eventsHeading: '',
    cultureHeading: '',
    conceptHeading: '',
    lineupHeading: '',
    galleryVideoUrl: '',
    eventsTagline: '',
  });

  // Visual effects text (stored in localStorage)
  const [marqueeWords, setMarqueeWords] = useState('');
  const [marqueeGenreWords, setMarqueeGenreWords] = useState('');

  // Content pages stored in localStorage until backend CMS is ready
  const [aboutContent, setAboutContent] = useState('');
  const [faqContent, setFaqContent] = useState('');
  const [termsContent, setTermsContent] = useState('');

  useEffect(() => {
    // Load landing content from site settings
    setLandingForm({
      heroGenres: siteSettings.heroGenres || 'Techno, House, Afro House, Minimal, Deep House, Amapiano, Drum & Bass',
      heroLocation: siteSettings.heroLocation || 'Oslo · Every Weekend',
      heroVibes: siteSettings.heroVibes || 'Underground culture, Live sets, Late night energy, Sound first',
      brandHeadline: siteSettings.brandHeadline || 'Where Oslo Comes Alive At Night',
      brandNarrative: siteSettings.brandNarrative || '',
      eventsHeading: siteSettings.eventsHeading || "What's Coming",
      cultureHeading: siteSettings.cultureHeading || 'The Culture',
      conceptHeading: siteSettings.conceptHeading || 'The Concept',
      lineupHeading: siteSettings.lineupHeading || 'The Lineup',
      galleryVideoUrl: siteSettings.galleryVideoUrl || '/media/sections/gallery/last 04.10.klubn.mp4',
      eventsTagline: siteSettings.eventsTagline || 'Curated nights. Handpicked lineups.',
    });

    // Load visual effects text from localStorage
    setMarqueeWords(localStorage.getItem('cms_marqueeWords') || '');
    setMarqueeGenreWords(localStorage.getItem('cms_marqueeGenreWords') || '');

    // Load CMS content from localStorage
    setAboutContent(localStorage.getItem('cms_about') || '');
    setFaqContent(localStorage.getItem('cms_faq') || '');
    setTermsContent(localStorage.getItem('cms_terms') || '');
  }, [siteSettings]);

  const handleSaveLanding = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      // Build the input explicitly — never spread the Apollo cache object directly
      // because cache proxies can include internal properties that HotChocolate rejects.
      await updateSettings({
        variables: {
          input: {
            id: siteSettings.id,
            siteName: siteSettings.siteName,
            tagline: siteSettings.tagline,
            logoUrl: siteSettings.logoUrl,
            faviconUrl: siteSettings.faviconUrl,
            primaryColor: siteSettings.primaryColor,
            secondaryColor: siteSettings.secondaryColor,
            accentColor: siteSettings.accentColor,
            heroTitle: siteSettings.heroTitle,
            heroSubtitle: siteSettings.heroSubtitle,
            heroCtaText: siteSettings.heroCtaText,
            heroCtaLink: siteSettings.heroCtaLink,
            heroBackgroundImageUrl: siteSettings.heroBackgroundImageUrl,
            heroBackgroundVideoUrl: siteSettings.heroBackgroundVideoUrl,
            heroOverlayOpacity: Number(siteSettings.heroOverlayOpacity),
            contactEmail: siteSettings.contactEmail,
            contactPhone: siteSettings.contactPhone,
            contactAddress: siteSettings.contactAddress,
            facebookUrl: siteSettings.facebookUrl,
            instagramUrl: siteSettings.instagramUrl,
            twitterUrl: siteSettings.twitterUrl,
            youTubeUrl: siteSettings.youTubeUrl,
            tikTokUrl: siteSettings.tikTokUrl,
            soundCloudUrl: siteSettings.soundCloudUrl,
            defaultEventImageUrl: siteSettings.defaultEventImageUrl,
            defaultDjImageUrl: siteSettings.defaultDjImageUrl,
            defaultVenueImageUrl: siteSettings.defaultVenueImageUrl,
            enableNewsletter: siteSettings.enableNewsletter,
            enableNotifications: siteSettings.enableNotifications,
            enableReviews: siteSettings.enableReviews,
            enableGamification: siteSettings.enableGamification,
            enableSubscriptions: siteSettings.enableSubscriptions,
            metaDescription: siteSettings.metaDescription,
            metaKeywords: siteSettings.metaKeywords,
            footerText: siteSettings.footerText,
            copyrightText: siteSettings.copyrightText,
            // Landing page content fields from the form
            heroGenres: landingForm.heroGenres,
            heroLocation: landingForm.heroLocation,
            heroVibes: landingForm.heroVibes,
            brandHeadline: landingForm.brandHeadline,
            brandNarrative: landingForm.brandNarrative,
            eventsHeading: landingForm.eventsHeading,
            eventsTagline: landingForm.eventsTagline,
            cultureHeading: landingForm.cultureHeading,
            conceptHeading: landingForm.conceptHeading,
            lineupHeading: landingForm.lineupHeading,
            galleryVideoUrl: landingForm.galleryVideoUrl,
          },
        },
      });
      await refetch();
      setFeedback({ type: 'success', text: 'Landing page content saved.' });
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Failed to save.';
      setFeedback({ type: 'error', text: msg });
    }
  };

  const handleSaveContent = (key: string, content: string, label: string) => {
    localStorage.setItem(`cms_${key}`, content);
    setFeedback({ type: 'success', text: `${label} content saved locally.` });
  };

  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'landing', label: 'Landing Page' },
    { id: 'about', label: 'About' },
    { id: 'faq', label: 'FAQ' },
    { id: 'terms', label: 'Terms & Privacy' },
  ];

  if (loading) {
    return <div className="text-sm text-gray-400">Loading settings…</div>;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">CMS</p>
        <h1 className="text-2xl font-semibold">Content Pages</h1>
        <p className="text-sm text-gray-400">
          Edit text content across the site. Landing page fields are stored in site settings.
          About, FAQ, and Terms are saved locally until the CMS backend is connected.
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFeedback(null); }}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.25em] transition-all ${
              activeTab === tab.id
                ? 'bg-white text-black font-semibold'
                : 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Landing page content */}
      {activeTab === 'landing' && (
        <form onSubmit={handleSaveLanding} className="space-y-6">
          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">Hero Section Text</h2>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Genre Tags (comma-separated)
              <input
                type="text"
                className={inputClass}
                value={landingForm.heroGenres}
                onChange={(e) => setLandingForm((p) => ({ ...p, heroGenres: e.target.value }))}
                placeholder="Techno, House, Afro House..."
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1 text-sm font-semibold text-gray-300">
                Location Line
                <input
                  type="text"
                  className={inputClass}
                  value={landingForm.heroLocation}
                  onChange={(e) => setLandingForm((p) => ({ ...p, heroLocation: e.target.value }))}
                />
              </label>
              <VideoUpload
                currentVideoUrl={landingForm.galleryVideoUrl}
                onVideoUploaded={(url) => setLandingForm((p) => ({ ...p, galleryVideoUrl: url }))}
                folder="gallery"
                label="Gallery Hero Video"
              />
            </div>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Vibe Words (comma-separated)
              <input
                type="text"
                className={inputClass}
                value={landingForm.heroVibes}
                onChange={(e) => setLandingForm((p) => ({ ...p, heroVibes: e.target.value }))}
                placeholder="Underground culture, Live sets..."
              />
            </label>
          </section>

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">Brand Statement</h2>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Headline
              <input
                type="text"
                className={inputClass}
                value={landingForm.brandHeadline}
                onChange={(e) => setLandingForm((p) => ({ ...p, brandHeadline: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Narrative
              <textarea
                className={textareaClass}
                value={landingForm.brandNarrative}
                onChange={(e) => setLandingForm((p) => ({ ...p, brandNarrative: e.target.value }))}
                placeholder="The brand story paragraph..."
              />
            </label>
          </section>

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">Section Headings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'eventsHeading' as const, label: 'Events Section' },
                { key: 'cultureHeading' as const, label: 'Culture Section' },
                { key: 'conceptHeading' as const, label: 'Concept Section' },
                { key: 'lineupHeading' as const, label: 'Lineup Section' },
              ].map((field) => (
                <label key={field.key} className="space-y-1 text-sm font-semibold text-gray-300">
                  {field.label}
                  <input
                    type="text"
                    className={inputClass}
                    value={landingForm[field.key]}
                    onChange={(e) => setLandingForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <label className="space-y-1 text-sm font-semibold text-gray-300">
              Events Page Tagline
              <input
                type="text"
                className={inputClass}
                value={landingForm.eventsTagline}
                onChange={(e) => setLandingForm((p) => ({ ...p, eventsTagline: e.target.value }))}
              />
            </label>
          </section>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Landing Content'}
          </button>
        </form>
      )}

      {/* Visual Effects section — always visible under landing tab */}
      {activeTab === 'landing' && (
        <section className="card space-y-4 mt-8">
          <h2 className="text-lg font-semibold">Visual Effects — Marquee Text</h2>
          <p className="text-xs text-gray-500">
            Customise the scrolling text banners on the landing page. Separate words with commas.
            Leave empty to use defaults.
          </p>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Marquee Ticker Words
            <input
              type="text"
              className={inputClass}
              value={marqueeWords}
              onChange={(e) => setMarqueeWords(e.target.value)}
              placeholder="BASS, GROOVE, RHYTHM, DROP, BEAT, PULSE, FLOW, VIBE, ENERGY, SOUND"
            />
            <span className="text-[0.65rem] text-gray-500 font-normal block mt-1">
              These appear in the first scrolling banner between sections (e.g. BASS · GROOVE · RHYTHM)
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-300">
            Genre Marquee Words
            <input
              type="text"
              className={inputClass}
              value={marqueeGenreWords}
              onChange={(e) => setMarqueeGenreWords(e.target.value)}
              placeholder="AFROBEAT, AMAPIANO, HIP HOP, SHATTA, DANCEHALL, HOUSE, TECHNO, R&B"
            />
            <span className="text-[0.65rem] text-gray-500 font-normal block mt-1">
              These appear in the second scrolling banner near the bottom of the page. Defaults to hero genre tags if empty.
            </span>
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              localStorage.setItem('cms_marqueeWords', marqueeWords);
              localStorage.setItem('cms_marqueeGenreWords', marqueeGenreWords);
              setFeedback({ type: 'success', text: 'Marquee text saved. Refresh the landing page to see changes.' });
            }}
          >
            Save Marquee Text
          </button>
        </section>
      )}

      {/* About page */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">About Page Content</h2>
            <p className="text-xs text-gray-500">
              Write in Markdown or plain text. This will be used on the About page.
            </p>
            <textarea
              className={`${textareaClass} min-h-[300px]`}
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              placeholder="Write the About page content here..."
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => handleSaveContent('about', aboutContent, 'About')}
          >
            Save About Content
          </button>
        </div>
      )}

      {/* FAQ page */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">FAQ Content</h2>
            <p className="text-xs text-gray-500">
              Format: Use "Q: question" and "A: answer" on separate lines. Separate entries with a blank line.
            </p>
            <textarea
              className={`${textareaClass} min-h-[300px]`}
              value={faqContent}
              onChange={(e) => setFaqContent(e.target.value)}
              placeholder={`Q: What is KlubN?\nA: KlubN is Oslo's premier club culture platform.\n\nQ: How do I get tickets?\nA: Browse events and purchase directly through the site.`}
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => handleSaveContent('faq', faqContent, 'FAQ')}
          >
            Save FAQ Content
          </button>
        </div>
      )}

      {/* Terms page */}
      {activeTab === 'terms' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Terms & Privacy Policy</h2>
            <p className="text-xs text-gray-500">
              Write in Markdown or plain text. This content will appear on the Terms & Privacy page.
            </p>
            <textarea
              className={`${textareaClass} min-h-[300px]`}
              value={termsContent}
              onChange={(e) => setTermsContent(e.target.value)}
              placeholder="Terms of Service and Privacy Policy content..."
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => handleSaveContent('terms', termsContent, 'Terms')}
          >
            Save Terms Content
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminContentPage;
