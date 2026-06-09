namespace DJDiP.Domain.Models
{
    public class SiteSetting
    {
        public Guid Id { get; set; }

        // Branding
        public string SiteName { get; set; } = "KlubN";
        public string Tagline { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
        public string FaviconUrl { get; set; } = string.Empty;

        // Colors
        public string PrimaryColor { get; set; } = "#FF0080"; // Pink
        public string SecondaryColor { get; set; } = "#00FF9F"; // Green
        public string AccentColor { get; set; } = "#000000"; // Black

        // Hero Section
        public string HeroTitle { get; set; } = "LET'S GO KLUBN";
        public string HeroSubtitle { get; set; } = "Immersive club culture, curated lineups, and underground energy — welcome to the KlubN experience.";
        public string HeroCtaText { get; set; } = "JOIN THE MOVEMENT";
        public string HeroCtaLink { get; set; } = "/events";
        public string HeroBackgroundImageUrl { get; set; } = "/media/sections/hero/hero-background.jpg";
        public string HeroBackgroundVideoUrl { get; set; } = string.Empty;
        public double HeroOverlayOpacity { get; set; } = 0.5;
        public string HeroGenres { get; set; } = string.Empty;
        public string HeroLocation { get; set; } = string.Empty;
        public string HeroVibes { get; set; } = string.Empty;

        // Landing Page Content
        public string BrandHeadline { get; set; } = string.Empty;
        public string BrandNarrative { get; set; } = string.Empty;
        public string EventsHeading { get; set; } = string.Empty;
        public string EventsTagline { get; set; } = string.Empty;
        public string CultureHeading { get; set; } = string.Empty;
        public string ConceptHeading { get; set; } = string.Empty;
        public string LineupHeading { get; set; } = string.Empty;
        public string GalleryVideoUrl { get; set; } = string.Empty;

        // Contact
        public string ContactEmail { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public string ContactAddress { get; set; } = string.Empty;

        // Social Media
        public string FacebookUrl { get; set; } = string.Empty;
        public string InstagramUrl { get; set; } = string.Empty;
        public string TwitterUrl { get; set; } = string.Empty;
        public string YouTubeUrl { get; set; } = string.Empty;
        public string TikTokUrl { get; set; } = string.Empty;
        public string SoundCloudUrl { get; set; } = string.Empty;

        // Default Images
        public string DefaultEventImageUrl { get; set; } = "/media/defaults/event.jpg";
        public string DefaultDjImageUrl { get; set; } = "/media/defaults/dj.jpg";
        public string DefaultVenueImageUrl { get; set; } = "/media/defaults/venue.jpg";

        // Features
        public bool EnableNewsletter { get; set; } = true;
        public bool EnableNotifications { get; set; } = true;
        public bool EnableReviews { get; set; } = true;
        public bool EnableGamification { get; set; } = true;
        public bool EnableSubscriptions { get; set; } = true;

        // SEO
        public string MetaDescription { get; set; } = string.Empty;
        public string MetaKeywords { get; set; } = string.Empty;

        // Footer
        public string FooterText { get; set; } = string.Empty;
        public string CopyrightText { get; set; } = $"© {DateTime.UtcNow.Year} KlubN. All rights reserved.";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
