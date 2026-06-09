using DJDiP.Application.DTO.SiteSettingsDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class SiteSettingsService : ISiteSettingsService
    {
        private readonly IUnitOfWork _unitOfWork;

        public SiteSettingsService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<SiteSettingsDto> GetAsync()
        {
            var settings = await GetOrCreateSettingsAsync();
            return Map(settings);
        }

        public async Task<SiteSettingsDto> UpdateAsync(UpdateSiteSettingsDto dto)
        {
            var settings = await GetOrCreateSettingsAsync();

            settings.SiteName = dto.SiteName;
            settings.Tagline = dto.Tagline;
            settings.LogoUrl = dto.LogoUrl;
            settings.FaviconUrl = dto.FaviconUrl;
            settings.PrimaryColor = dto.PrimaryColor;
            settings.SecondaryColor = dto.SecondaryColor;
            settings.AccentColor = dto.AccentColor;
            settings.HeroTitle = dto.HeroTitle;
            settings.HeroSubtitle = dto.HeroSubtitle;
            settings.HeroCtaText = dto.HeroCtaText;
            settings.HeroCtaLink = dto.HeroCtaLink;
            settings.HeroBackgroundImageUrl = dto.HeroBackgroundImageUrl;
            settings.HeroBackgroundVideoUrl = dto.HeroBackgroundVideoUrl;
            settings.HeroOverlayOpacity = dto.HeroOverlayOpacity;
            settings.HeroGenres = dto.HeroGenres;
            settings.HeroLocation = dto.HeroLocation;
            settings.HeroVibes = dto.HeroVibes;
            settings.BrandHeadline = dto.BrandHeadline;
            settings.BrandNarrative = dto.BrandNarrative;
            settings.EventsHeading = dto.EventsHeading;
            settings.EventsTagline = dto.EventsTagline;
            settings.CultureHeading = dto.CultureHeading;
            settings.ConceptHeading = dto.ConceptHeading;
            settings.LineupHeading = dto.LineupHeading;
            settings.GalleryVideoUrl = dto.GalleryVideoUrl;
            settings.ContactEmail = dto.ContactEmail;
            settings.ContactPhone = dto.ContactPhone;
            settings.ContactAddress = dto.ContactAddress;
            settings.FacebookUrl = dto.FacebookUrl;
            settings.InstagramUrl = dto.InstagramUrl;
            settings.TwitterUrl = dto.TwitterUrl;
            settings.YouTubeUrl = dto.YouTubeUrl;
            settings.TikTokUrl = dto.TikTokUrl;
            settings.SoundCloudUrl = dto.SoundCloudUrl;
            settings.DefaultEventImageUrl = dto.DefaultEventImageUrl;
            settings.DefaultDjImageUrl = dto.DefaultDjImageUrl;
            settings.DefaultVenueImageUrl = dto.DefaultVenueImageUrl;
            settings.EnableNewsletter = dto.EnableNewsletter;
            settings.EnableNotifications = dto.EnableNotifications;
            settings.EnableReviews = dto.EnableReviews;
            settings.EnableGamification = dto.EnableGamification;
            settings.EnableSubscriptions = dto.EnableSubscriptions;
            settings.MetaDescription = dto.MetaDescription;
            settings.MetaKeywords = dto.MetaKeywords;
            settings.FooterText = dto.FooterText;
            settings.CopyrightText = dto.CopyrightText;
            settings.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SiteSettings.UpdateAsync(settings);
            await _unitOfWork.SaveChangesAsync();

            return Map(settings);
        }

        private async Task<SiteSetting> GetOrCreateSettingsAsync()
        {
            var existing = (await _unitOfWork.SiteSettings.GetAllAsync()).FirstOrDefault();
            if (existing != null)
            {
                return existing;
            }

            var fallback = new SiteSetting();
            await _unitOfWork.SiteSettings.AddAsync(fallback);
            await _unitOfWork.SaveChangesAsync();
            return fallback;
        }

        private static SiteSettingsDto Map(SiteSetting entity)
        {
            return new SiteSettingsDto
            {
                Id = entity.Id,
                SiteName = entity.SiteName,
                Tagline = entity.Tagline,
                LogoUrl = entity.LogoUrl,
                FaviconUrl = entity.FaviconUrl,
                PrimaryColor = entity.PrimaryColor,
                SecondaryColor = entity.SecondaryColor,
                AccentColor = entity.AccentColor,
                HeroTitle = entity.HeroTitle,
                HeroSubtitle = entity.HeroSubtitle,
                HeroCtaText = entity.HeroCtaText,
                HeroCtaLink = entity.HeroCtaLink,
                HeroBackgroundImageUrl = entity.HeroBackgroundImageUrl,
                HeroBackgroundVideoUrl = entity.HeroBackgroundVideoUrl,
                HeroOverlayOpacity = entity.HeroOverlayOpacity,
                HeroGenres = entity.HeroGenres,
                HeroLocation = entity.HeroLocation,
                HeroVibes = entity.HeroVibes,
                BrandHeadline = entity.BrandHeadline,
                BrandNarrative = entity.BrandNarrative,
                EventsHeading = entity.EventsHeading,
                EventsTagline = entity.EventsTagline,
                CultureHeading = entity.CultureHeading,
                ConceptHeading = entity.ConceptHeading,
                LineupHeading = entity.LineupHeading,
                GalleryVideoUrl = entity.GalleryVideoUrl,
                ContactEmail = entity.ContactEmail,
                ContactPhone = entity.ContactPhone,
                ContactAddress = entity.ContactAddress,
                FacebookUrl = entity.FacebookUrl,
                InstagramUrl = entity.InstagramUrl,
                TwitterUrl = entity.TwitterUrl,
                YouTubeUrl = entity.YouTubeUrl,
                TikTokUrl = entity.TikTokUrl,
                SoundCloudUrl = entity.SoundCloudUrl,
                DefaultEventImageUrl = entity.DefaultEventImageUrl,
                DefaultDjImageUrl = entity.DefaultDjImageUrl,
                DefaultVenueImageUrl = entity.DefaultVenueImageUrl,
                EnableNewsletter = entity.EnableNewsletter,
                EnableNotifications = entity.EnableNotifications,
                EnableReviews = entity.EnableReviews,
                EnableGamification = entity.EnableGamification,
                EnableSubscriptions = entity.EnableSubscriptions,
                MetaDescription = entity.MetaDescription,
                MetaKeywords = entity.MetaKeywords,
                FooterText = entity.FooterText,
                CopyrightText = entity.CopyrightText
            };
        }
    }
}
