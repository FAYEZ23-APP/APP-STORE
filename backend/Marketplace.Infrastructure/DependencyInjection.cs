using Marketplace.Application.Interfaces;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Data;
using Marketplace.Infrastructure.Delivery;
using Marketplace.Infrastructure.Notifications;
using Marketplace.Infrastructure.Repositories;
using Marketplace.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Marketplace.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        // Database (PostgreSQL only - strictly from configuration)
        var connStr = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(connStr);
        });

        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Storage Services (Local file storage and S3/R2 abstraction)
        services.Configure<Marketplace.Application.Common.StorageSettings>(
            configuration.GetSection(Marketplace.Application.Common.StorageSettings.SectionName));
        services.AddSingleton<Marketplace.Infrastructure.Storage.LocalFileStorageProvider>();
        services.AddSingleton<Marketplace.Infrastructure.Storage.S3CompatibleStorageProvider>();
        services.AddSingleton<IFileStorageProvider>(sp =>
        {
            var storageProvider = configuration["Storage:Provider"] ?? "Local";
            if (string.Equals(storageProvider, "S3", StringComparison.OrdinalIgnoreCase))
            {
                return sp.GetRequiredService<Marketplace.Infrastructure.Storage.S3CompatibleStorageProvider>();
            }
            return sp.GetRequiredService<Marketplace.Infrastructure.Storage.LocalFileStorageProvider>();
        });

        services.AddScoped<IImageUploadService, Marketplace.Infrastructure.Storage.ImageUploadService>();

        // Auth
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddScoped<IJwtService, JwtService>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<ITwoFactorSecretProtector, AesGcmSecretProtector>();
        services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();

        // Email and SMS Senders
        services.AddSingleton<IFakeMessageStore, FakeMessageStore>();
        services.Configure<Marketplace.Application.Common.SmsSettings>(
            configuration.GetSection(Marketplace.Application.Common.SmsSettings.SectionName));

        var isDev = environment?.IsDevelopment() ?? string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

        if (isDev)
        {
            services.AddSingleton<IEmailSender, ConsoleEmailSender>();
            services.AddSingleton<ISmsSender, ConsoleSmsSender>();
        }
        else
        {
            services.AddHttpClient<IEmailSender, ResendEmailSender>();
            var smsProvider = configuration["Sms:Provider"] ?? "NotConfigured";
            if (string.Equals(smsProvider, "HttpGateway", StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient<ISmsSender, Marketplace.Infrastructure.Notifications.ConfigurableHttpSmsSender>();
            }
            else if (string.Equals(smsProvider, "Console", StringComparison.OrdinalIgnoreCase))
            {
                services.AddSingleton<ISmsSender, ConsoleSmsSender>();
            }
            else
            {
                services.AddSingleton<ISmsSender, Marketplace.Infrastructure.Notifications.NotConfiguredSmsSender>();
            }
        }

        // Delivery Provider (selected by configuration, defaults to "Fake")
        var deliveryProviderName = configuration["Delivery:Provider"] ?? "Fake";
        switch (deliveryProviderName.ToLowerInvariant())
        {
            case "fake":
            default:
                services.AddSingleton<IDeliveryProvider, FakeDeliveryProvider>();
                break;
        }

        // Push Notifications (Expo / FCM) & Bounded In-Memory Queue
        services.AddHttpClient<IPushNotificationProvider, Marketplace.Infrastructure.Notifications.ExpoPushNotificationProvider>();
        services.AddSingleton<IPushNotificationQueue, Marketplace.Infrastructure.Notifications.PushNotificationQueue>();

        // Google Maps & Shipping Calculation
        services.Configure<Marketplace.Application.Common.GoogleMapsSettings>(
            configuration.GetSection(Marketplace.Application.Common.GoogleMapsSettings.SectionName));
        services.AddHttpClient<IShippingDistanceService, Marketplace.Infrastructure.Shipping.ShippingDistanceService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(8);
        });

        // Background Services
        services.AddHostedService<Marketplace.Infrastructure.BackgroundServices.VerificationCodeCleanupService>();
        services.AddHostedService<Marketplace.Infrastructure.BackgroundServices.NotificationCleanupService>();
        services.AddHostedService<Marketplace.Infrastructure.BackgroundServices.PushNotificationBackgroundWorker>();
        services.AddSingleton<Marketplace.Infrastructure.BackgroundServices.RefreshTokenCleanupService>();
        services.AddSingleton<IRefreshTokenCleanupService>(sp => sp.GetRequiredService<Marketplace.Infrastructure.BackgroundServices.RefreshTokenCleanupService>());
        services.AddHostedService(sp => sp.GetRequiredService<Marketplace.Infrastructure.BackgroundServices.RefreshTokenCleanupService>());

        return services;
    }
}
