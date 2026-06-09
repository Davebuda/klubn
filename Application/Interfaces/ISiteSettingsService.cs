using DJDiP.Application.DTO.SiteSettingsDTO;

namespace DJDiP.Application.Interfaces
{
    public interface ISiteSettingsService
    {
        Task<SiteSettingsDto> GetAsync();
        Task<SiteSettingsDto> UpdateAsync(UpdateSiteSettingsDto dto);
    }
}
