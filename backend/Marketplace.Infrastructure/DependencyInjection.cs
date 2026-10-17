using Marketplace.Application.Interfaces;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Data;
using Marketplace.Infrastructure.Delivery;
using Marketplace.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Database (PostgreSQL by default; optional InMemory mode for isolated testing without modifying PostgreSQL)
        var useInMemory = string.Equals(configuration["UseInMemoryDatabase"], "true", StringComparison.OrdinalIgnoreCase);
        if (useInMemory)
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("MarketplaceTestDb"));
        }
        else
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));
        }

        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Auth
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddScoped<IJwtService, JwtService>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();

        // Delivery Provider (selected by configuration, defaults to "Fake")
        var deliveryProviderName = configuration["Delivery:Provider"] ?? "Fake";
        switch (deliveryProviderName.ToLowerInvariant())
        {
            case "fake":
            default:
                services.AddSingleton<IDeliveryProvider, FakeDeliveryProvider>();
                break;
        }

        // Push Notifications (Expo / FCM)
        services.AddHttpClient<IPushNotificationProvider, Marketplace.Infrastructure.Notifications.ExpoPushNotificationProvider>();

        return services;
    }
}
