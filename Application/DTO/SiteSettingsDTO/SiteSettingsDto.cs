namespace DJDiP.Application.DTO.SiteSettingsDTO
{
    public class SiteSettingsDto
    {
        public Guid Id { get; set; }
        public string SiteName { get; set; } = string.Empty;
        public string Tagline { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
        public string FaviconUrl { get; set; } = string.Empty;
        public string PrimaryColor { get; set; } = string.Empty;
        public string SecondaryColor { get; set; } = string.Empty;
        public string AccentColor { get; set; } = string.Empty;
        public string HeroTitle { get; set; } = string.Empty;
        public string HeroSubtitle { get; set; } = string.Empty;
        public string HeroCtaText { get; set; } = string.Empty;
        public string HeroCtaLink { get; set; } = string.Empty;
        public string HeroBackgroundImageUrl { get; set; } = string.Empty;
        public string HeroBackgroundVideoUrl { get; set; } = string.Empty;
        public double HeroOverlayOpacity { get; set; }
        public string HeroGenres { get; set; } = string.Empty;
        public string HeroLocation { get; set; } = string.Empty;
        public string HeroVibes { get; set; } = string.Empty;
        public string BrandHeadline { get; set; } = string.Empty;
        public string BrandNarrative { get; set; } = string.Empty;
        public string EventsHeading { get; set; } = string.Empty;
        public string EventsTagline { get; set; } = string.Empty;
        public string CultureHeading { get; set; } = string.Empty;
        public string ConceptHeading { get; set; } = string.Empty;
        public string LineupHeading { get; set; } = string.Empty;
        public string GalleryVideoUrl { get; set; } = string.Empty;
        public string ContactEmail { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public string ContactAddress { get; set; } = string.Empty;
        public string FacebookUrl { get; set; } = string.Empty;
        public string InstagramUrl { get; set; } = string.Empty;
        public string TwitterUrl { get; set; } = string.Empty;
        public string YouTubeUrl { get; set; } = string.Empty;
        public string TikTokUrl { get; set; } = string.Empty;
        public string SoundCloudUrl { get; set; } = string.Empty;
        public string DefaultEventImageUrl { get; set; } = string.Empty;
        public string DefaultDjImageUrl { get; set; } = string.Empty;
        public string DefaultVenueImageUrl { get; set; } = string.Empty;
        public bool EnableNewsletter { get; set; }
        public bool EnableNotifications { get; set; }
        public bool EnableReviews { get; set; }
        public bool EnableGamification { get; set; }
        public bool EnableSubscriptions { get; set; }
        public string MetaDescription { get; set; } = string.Empty;
        public string MetaKeywords { get; set; } = string.Empty;
        public string FooterText { get; set; } = string.Empty;
        public string CopyrightText { get; set; } = string.Empty;
    }
}
