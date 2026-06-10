namespace DJDiP.Application.Options
{
    // Bound from the "AppSettings" configuration section (env keys AppSettings__BaseUrl /
    // AppSettings__FrontendUrl). FrontendUrl is the public SPA origin used to build links in
    // outbound email (e.g. the wallet "/tickets" link in the order confirmation, design §4.4).
    public class AppSettings
    {
        public const string SectionName = "AppSettings";

        public string BaseUrl { get; set; } = "http://localhost:5000";
        public string FrontendUrl { get; set; } = "http://localhost:3000";
    }
}
