import { useSiteSettings } from '../../context/SiteSettingsContext';
import { isRealSocialUrl } from '../../utils/social';
import { safeHttpUrl } from '../../lib/safeHttpUrl';
import VippsIcon from './VippsIcon';

const Footer = () => {
  const { siteSettings } = useSiteSettings();
  const contactEmail = siteSettings.contactEmail || 'letsgoklubn@gmail.com';
  const footerText =
    siteSettings.footerText ||
    'Nightlife technology for the selectors, venues, and fans pushing culture forward.';

  const socialLinks = [
    { label: 'Instagram', url: siteSettings.instagramUrl },
    { label: 'Facebook', url: siteSettings.facebookUrl },
    { label: 'Twitter', url: siteSettings.twitterUrl },
    { label: 'YouTube', url: siteSettings.youTubeUrl },
    { label: 'TikTok', url: siteSettings.tikTokUrl },
    { label: 'SoundCloud', url: siteSettings.soundCloudUrl },
  ].filter((item) => isRealSocialUrl(item.url));

  return (
    <footer className="relative z-10 mt-24 w-full max-w-full border-t border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent py-14 text-sm text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="space-y-3">
          <p className="text-lg font-bold tracking-[0.4em] text-white">{siteSettings.siteName}</p>
          <p className="text-gray-400">{footerText}</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">Platform</p>
          <div className="flex flex-col space-y-2">
            <a href="/events" className="hover:text-white transition">
              Events
            </a>
            <a href="/tickets" className="hover:text-white transition">
              Tickets
            </a>
            <a href="/gallery" className="hover:text-white transition">
              Gallery
            </a>
            <a href="/contact" className="hover:text-white transition">
              Contact
            </a>
            <a href="/terms" className="hover:text-white transition">
              Terms of Sale
            </a>
            <a href="/privacy" className="hover:text-white transition">
              Privacy
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">Connect</p>
          <div className="flex flex-col space-y-2">
            <a href={`mailto:${contactEmail}`} className="hover:text-white transition">
              {contactEmail}
            </a>
            {socialLinks.map((link) => {
              const safeLinkUrl = safeHttpUrl(link.url);
              return safeLinkUrl ? (
                <a key={link.label} href={safeLinkUrl} target="_blank" rel="noreferrer" className="hover:text-white transition">
                  {link.label}
                </a>
              ) : null;
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">Stay in the loop</p>
          <p>Weekly drops, openings, and presale codes. One email. No noise.</p>
          <form className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-white placeholder-gray-500 focus:border-orange-400 focus:outline-none"
              type="email"
              placeholder="Email address"
            />
            <button
              type="submit"
              className="rounded-full bg-white text-black px-5 py-2 text-xs font-semibold tracking-[0.3em] uppercase"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-gray-500 space-y-3">
        {/* Payment acceptance row — official Vipps icon only (per brand owner:
            icon, never a redrawn wordmark); card schemes as plain text since we
            hold no licensed card artwork. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-gray-500">
          <VippsIcon className="h-5 w-5 rounded-[4px]" />
          <span aria-hidden="true">·</span>
          <span className="tracking-wide">Visa</span>
          <span aria-hidden="true">·</span>
          <span className="tracking-wide">Mastercard</span>
        </div>
        <p className="text-gray-500">
          DJ DIP AV BUKENYA · Org. nr 933 809 048 · St. Edmunds Vei 39D, 0280 Oslo, Norway ·{' '}
          <a href="mailto:tickets@klubn.no" className="hover:text-white transition">tickets@klubn.no</a> · +47 967 36 112
        </p>
        <p className="tracking-[0.4em]">
          {siteSettings.copyrightText ||
            `© ${new Date().getFullYear()} ${siteSettings.siteName}. Crafted for the culture.`}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
