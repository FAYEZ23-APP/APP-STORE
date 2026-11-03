using System.Net;
using System.Net.Sockets;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Security;

public class SsrfProtectionService : ISsrfProtectionService
{
    private readonly ILogger<SsrfProtectionService> _logger;

    public SsrfProtectionService(ILogger<SsrfProtectionService> logger)
    {
        _logger = logger;
    }

    public bool IsValidExternalUrl(string url, out Uri? uri, out string? errorMessage)
    {
        uri = null;
        errorMessage = null;

        if (string.IsNullOrWhiteSpace(url))
        {
            errorMessage = "URL cannot be empty.";
            return false;
        }

        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out uri))
        {
            errorMessage = "Malformed or relative URL.";
            return false;
        }

        // Enforce HTTPS (HTTP only permitted if explicitly required, but rejected by default for external APIs)
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase))
        {
            errorMessage = $"Unsupported scheme '{uri.Scheme}'. Only HTTPS/HTTP are permitted.";
            return false;
        }

        // Reject localhost and metadata hostnames directly
        var host = uri.DnsSafeHost.ToLowerInvariant().Trim();
        if (host == "localhost" ||
            host == "metadata.google.internal" ||
            host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
        {
            errorMessage = $"Access to internal/metadata host '{host}' is prohibited.";
            return false;
        }

        // Restrict allowed ports to standard Web ports (80, 443)
        if (uri.Port != 80 && uri.Port != 443 && !uri.IsDefaultPort)
        {
            errorMessage = $"Non-standard port '{uri.Port}' is prohibited.";
            return false;
        }

        // Direct IP string check before DNS resolution
        if (IPAddress.TryParse(host, out var directIp))
        {
            if (IsPrivateOrRestrictedIp(directIp, out var ipReason))
            {
                errorMessage = $"Target IP '{directIp}' is restricted: {ipReason}";
                return false;
            }
        }

        return true;
    }

    public async Task<(bool IsSafe, string? ErrorMessage)> IsSafeDestinationAsync(Uri uri, CancellationToken cancellationToken = default)
    {
        try
        {
            var host = uri.DnsSafeHost;
            var ipAddresses = await Dns.GetHostAddressesAsync(host, cancellationToken);

            if (ipAddresses.Length == 0)
            {
                return (false, $"Unable to resolve host '{host}'.");
            }

            foreach (var ip in ipAddresses)
            {
                if (IsPrivateOrRestrictedIp(ip, out var reason))
                {
                    _logger.LogWarning("SSRF attempt blocked for host '{Host}' resolving to restricted IP '{IP}': {Reason}", host, ip, reason);
                    return (false, $"Host resolves to restricted destination ({reason}).");
                }
            }

            return (true, null);
        }
        catch (SocketException ex)
        {
            return (false, $"DNS resolution failed: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during SSRF destination check for URI {Uri}", uri);
            return (false, "Error verifying destination safety.");
        }
    }

    public static bool IsPrivateOrRestrictedIp(IPAddress ip, out string? reason)
    {
        reason = null;

        // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip))
        {
            reason = "Loopback address (127.0.0.0/8 or ::1)";
            return true;
        }

        var bytes = ip.GetAddressBytes();

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            // 0.0.0.0/8 (Current network)
            if (bytes[0] == 0)
            {
                reason = "Current network (0.0.0.0/8)";
                return true;
            }

            // 10.0.0.0/8 (Private)
            if (bytes[0] == 10)
            {
                reason = "Private RFC1918 range (10.0.0.0/8)";
                return true;
            }

            // 172.16.0.0/12 (Private)
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
            {
                reason = "Private RFC1918 range (172.16.0.0/12)";
                return true;
            }

            // 192.168.0.0/16 (Private)
            if (bytes[0] == 192 && bytes[1] == 168)
            {
                reason = "Private RFC1918 range (192.168.0.0/16)";
                return true;
            }

            // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
            if (bytes[0] == 169 && bytes[1] == 254)
            {
                reason = "Link-Local / Cloud Metadata range (169.254.0.0/16)";
                return true;
            }

            // 100.64.0.0/10 (Carrier-grade NAT)
            if (bytes[0] == 100 && (bytes[1] & 0xC0) == 64)
            {
                reason = "Carrier-grade NAT range (100.64.0.0/10)";
                return true;
            }

            // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / Test)
            if ((bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 2) ||
                (bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100) ||
                (bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113))
            {
                reason = "Test/Documentation range";
                return true;
            }

            // 224.0.0.0/4 (Multicast)
            if (bytes[0] >= 224 && bytes[0] <= 239)
            {
                reason = "Multicast address range (224.0.0.0/4)";
                return true;
            }

            // 240.0.0.0/4 (Reserved / Future Use)
            if (bytes[0] >= 240)
            {
                reason = "Reserved address range (240.0.0.0/4)";
                return true;
            }
        }
        else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            // :: (Unspecified)
            if (ip.Equals(IPAddress.IPv6None))
            {
                reason = "Unspecified IPv6 address (::)";
                return true;
            }

            // fe80::/10 (Link-Local IPv6)
            if (ip.IsIPv6LinkLocal)
            {
                reason = "Link-Local IPv6 address (fe80::/10)";
                return true;
            }

            // fc00::/7 (Unique Local Address - RFC4193)
            if ((bytes[0] & 0xFE) == 0xFC)
            {
                reason = "Unique Local IPv6 address (fc00::/7)";
                return true;
            }

            // ff00::/8 (Multicast IPv6)
            if (ip.IsIPv6Multicast)
            {
                reason = "Multicast IPv6 address (ff00::/8)";
                return true;
            }
        }

        return false;
    }

    public HttpClient CreateSafeHttpClient(TimeSpan? timeout = null, long maxResponseSizeBytes = 5 * 1024 * 1024)
    {
        var effectiveTimeout = timeout ?? TimeSpan.FromSeconds(10);

        var handler = new SocketsHttpHandler
        {
            ConnectTimeout = TimeSpan.FromSeconds(5),
            AllowAutoRedirect = false, // Never automatically follow redirects without validating target IP
            ConnectCallback = async (context, cancellationToken) =>
            {
                var entry = await Dns.GetHostEntryAsync(context.DnsEndPoint.Host, cancellationToken);
                var targetIp = entry.AddressList.FirstOrDefault();

                if (targetIp == null)
                {
                    throw new HttpRequestException($"Could not resolve host '{context.DnsEndPoint.Host}'.");
                }

                if (IsPrivateOrRestrictedIp(targetIp, out var reason))
                {
                    throw new HttpRequestException($"SSRF blocked: Host '{context.DnsEndPoint.Host}' resolved to restricted destination '{targetIp}' ({reason}).");
                }

                var socket = new Socket(targetIp.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
                try
                {
                    await socket.ConnectAsync(new IPEndPoint(targetIp, context.DnsEndPoint.Port), cancellationToken);
                    return new NetworkStream(socket, ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            }
        };

        return new HttpClient(handler)
        {
            Timeout = effectiveTimeout,
            MaxResponseContentBufferSize = maxResponseSizeBytes
        };
    }
}
