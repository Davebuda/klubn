using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DJDiP.Infrastructure.Payments.Vipps
{
    // Process-wide cache for the Vipps access token (P4). Registered as a SINGLETON:
    // the token is merchant-scoped (not user-scoped), short-lived, and fetching one
    // per request would hammer POST /accesstoken/get. Thread-safe via SemaphoreSlim;
    // refreshes 60s before expiry so in-flight requests never carry a dead token.
    //
    // API shape (verified against developer.vippsmobilepay.com quick-start, 2026-06-10):
    //   POST {BaseUrl}/accesstoken/get
    //   Headers: client_id, client_secret, Ocp-Apim-Subscription-Key, Merchant-Serial-Number
    //   Response: { access_token, expires_in (seconds, string), expires_on (epoch, string), ... }
    public sealed class VippsAccessTokenCache
    {
        private readonly IHttpClientFactory _httpFactory;
        private readonly VippsOptions _opts;
        private readonly ILogger<VippsAccessTokenCache> _log;
        private readonly SemaphoreSlim _gate = new(1, 1);

        private string? _token;
        private DateTimeOffset _expiresAt = DateTimeOffset.MinValue;

        public VippsAccessTokenCache(
            IHttpClientFactory httpFactory,
            IOptions<VippsOptions> opts,
            ILogger<VippsAccessTokenCache> log)
        {
            _httpFactory = httpFactory;
            _opts = opts.Value;
            _log = log;
        }

        public async Task<string> GetTokenAsync(CancellationToken ct)
        {
            // Fast path: cached and not within the 60s refresh window.
            if (_token is not null && DateTimeOffset.UtcNow < _expiresAt.AddSeconds(-60))
                return _token;

            await _gate.WaitAsync(ct);
            try
            {
                if (_token is not null && DateTimeOffset.UtcNow < _expiresAt.AddSeconds(-60))
                    return _token; // another caller refreshed while we waited

                using var req = new HttpRequestMessage(HttpMethod.Post,
                    new Uri(new Uri(_opts.BaseUrl), "/accesstoken/get"));
                req.Headers.Add("client_id", _opts.ClientId);
                req.Headers.Add("client_secret", _opts.ClientSecret);
                req.Headers.Add("Ocp-Apim-Subscription-Key", _opts.SubscriptionKey);
                req.Headers.Add("Merchant-Serial-Number", _opts.Msn);

                var http = _httpFactory.CreateClient(nameof(VippsAccessTokenCache));
                using var res = await http.SendAsync(req, ct);
                var body = await res.Content.ReadAsStringAsync(ct);

                if (!res.IsSuccessStatusCode)
                {
                    // Never log the response body here — it can echo credential hints.
                    _log.LogError("Vipps access token request failed: {Status}.", (int)res.StatusCode);
                    throw new InvalidOperationException("Could not authenticate with the payment provider.");
                }

                var parsed = JsonSerializer.Deserialize<TokenResponse>(body)
                             ?? throw new InvalidOperationException("Empty Vipps token response.");
                if (string.IsNullOrEmpty(parsed.AccessToken))
                    throw new InvalidOperationException("Vipps token response had no access_token.");

                _token = parsed.AccessToken;
                // expires_on is epoch seconds (string). Fall back to expires_in, then 5 min.
                if (long.TryParse(parsed.ExpiresOn, out var epoch))
                    _expiresAt = DateTimeOffset.FromUnixTimeSeconds(epoch);
                else if (long.TryParse(parsed.ExpiresIn, out var seconds))
                    _expiresAt = DateTimeOffset.UtcNow.AddSeconds(seconds);
                else
                    _expiresAt = DateTimeOffset.UtcNow.AddMinutes(5);

                _log.LogInformation("Vipps access token refreshed; valid until {ExpiresAt:u}.", _expiresAt);
                return _token;
            }
            finally
            {
                _gate.Release();
            }
        }

        private sealed class TokenResponse
        {
            [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
            [JsonPropertyName("expires_in")] public string? ExpiresIn { get; set; }
            [JsonPropertyName("expires_on")] public string? ExpiresOn { get; set; }
        }
    }
}
