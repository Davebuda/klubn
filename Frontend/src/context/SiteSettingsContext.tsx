import { ReactNode, createContext, useContext } from 'react';
import { ApolloError, useQuery } from '@apollo/client';
import { GET_SITE_SETTINGS } from '../graphql/queries';

export interface SiteSettings {
  id: string;
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  heroBackgroundImageUrl: string;
  heroBackgroundVideoUrl: string;
  heroOverlayOpacity: number;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  youTubeUrl: string;
  tikTokUrl: string;
  soundCloudUrl: string;
  defaultEventImageUrl: string;
  defaultDjImageUrl: string;
  defaultVenueImageUrl: string;
  enableNewsletter: boolean;
  enableNotifications: boolean;
  enableReviews: boolean;
  enableGamification: boolean;
  enableSubscriptions: boolean;
  metaDescription: string;
  metaKeywords: string;
  footerText: string;
  copyrightText: string;
  // Landing page content fields
  heroGenres: string;
  heroLocation: string;
  heroVibes: string;
  brandHeadline: string;
  brandNarrative: string;
  eventsHeading: string;
  cultureHeading: string;
  conceptHeading: string;
  lineupHeading: string;
  galleryVideoUrl: string;
  eventsTagline: string;
}

export const defaultSiteSettings: SiteSettings = {
  id: '',
  siteName: 'Lets Go KlubN',
  tagline: 'High life sound system',
  logoUrl: '/icons/lets-go-klubn-320.png',
  faviconUrl: '/icons/lets-go-klubn-32.png',
  primaryColor: '#FF0080',
  secondaryColor: '#00FF9F',
  accentColor: '#000000',
  heroTitle: "Let's Go KlubN",
  heroSubtitle:
    'Culture-forward bookings, immersive visuals, and the club technology powering tomorrow’s dance floors.',
  heroCtaText: 'Discover Events',
  heroCtaLink: '/events',
  heroBackgroundImageUrl: '/media/defaults/event.svg',
  heroBackgroundVideoUrl: '',
  heroOverlayOpacity: 0.6,
  contactEmail: 'letsgoklubn@gmail.com',
  contactPhone: '+1 (555) 555-5555',
  contactAddress: 'Worldwide',
  facebookUrl: 'https://facebook.com',
  instagramUrl: 'https://instagram.com',
  twitterUrl: 'https://twitter.com',
  youTubeUrl: 'https://youtube.com',
  tikTokUrl: 'https://tiktok.com',
  soundCloudUrl: 'https://soundcloud.com',
  defaultEventImageUrl: '/media/defaults/event.jpg',
  defaultDjImageUrl: '/media/defaults/dj.svg',
  defaultVenueImageUrl: '/media/defaults/venue.svg',
  enableNewsletter: true,
  enableNotifications: true,
  enableReviews: true,
  enableGamification: true,
  enableSubscriptions: true,
  metaDescription: '',
  metaKeywords: '',
  footerText: 'Nightlife technology for the selectors, venues, and fans pushing culture forward.',
  copyrightText: `© ${new Date().getFullYear()} Lets Go KlubN. Crafted for the culture.`,
  // Landing page content
  heroGenres: 'Techno, House, Afro House, Minimal, Deep House, Amapiano, Drum & Bass',
  heroLocation: 'Oslo · Every Weekend',
  heroVibes: 'Underground culture, Live sets, Late night energy, Sound first',
  brandHeadline: 'Where Oslo Comes Alive At Night',
  brandNarrative: '',
  eventsHeading: "What's Coming",
  cultureHeading: 'The Culture',
  conceptHeading: 'The Concept',
  lineupHeading: 'The Lineup',
  galleryVideoUrl: '/media/sections/gallery/last 04.10.klubn.mp4',
  eventsTagline: 'Curated nights. Handpicked lineups.',
};

type SiteSettingsContextValue = {
  siteSettings: SiteSettings;
  loading: boolean;
  error?: ApolloError;
  refetch: () => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  siteSettings: defaultSiteSettings,
  loading: true,
  refetch: () => undefined,
});

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { data, loading, error, refetch } = useQuery(GET_SITE_SETTINGS);
  const siteSettings = data?.siteSettings ?? defaultSiteSettings;

  return (
    <SiteSettingsContext.Provider
      value={{
        siteSettings,
        loading,
        error,
        refetch: () => {
          refetch();
        },
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
