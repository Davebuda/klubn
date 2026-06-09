namespace DJDiP.Domain.Models
{
    public class SocialMediaLinks
    {
        public Guid Id { get; set; }
        public Guid DJProfileId { get; set; }

        public string? Instagram { get; set; }
        public string? Facebook { get; set; }
        public string? Twitter { get; set; }
        public string? TikTok { get; set; }
        public string? YouTube { get; set; }
        public string? SoundCloud { get; set; }
        public string? Spotify { get; set; }
        public string? AppleMusic { get; set; }
        public string? Beatport { get; set; }
        public string? MixCloud { get; set; }
        public string? Website { get; set; }
        public string? Discord { get; set; }
        public string? Twitch { get; set; }

        public DJProfile DJProfile { get; set; } = null!;
    }
}
