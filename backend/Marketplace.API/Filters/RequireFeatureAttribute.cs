using Marketplace.Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Marketplace.API.Filters;

public enum FeatureFlag
{
    Wallet,
    VendorPayouts,
    Coupons,
    GoogleAuth,
    PhoneSignup,
    AdminWeb
}

/// <summary>
/// Authorization filter that gates routes behind configured feature flags.
/// Runs at the authorization stage before model binding/validation.
/// Returns 404 Not Found when the specified feature flag is disabled.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public class RequireFeatureAttribute : Attribute, IAsyncAuthorizationFilter
{
    public FeatureFlag Feature { get; }

    public RequireFeatureAttribute(FeatureFlag feature)
    {
        Feature = feature;
    }

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var flags = context.HttpContext.RequestServices.GetRequiredService<IOptions<FeatureFlags>>().Value;

        bool isEnabled = Feature switch
        {
            FeatureFlag.Wallet => flags.EnableWallet,
            FeatureFlag.VendorPayouts => flags.EnableVendorPayouts,
            FeatureFlag.Coupons => flags.EnableCoupons,
            FeatureFlag.GoogleAuth => flags.GoogleEnabled,
            FeatureFlag.PhoneSignup => flags.PhoneSignupEnabled,
            FeatureFlag.AdminWeb => flags.AdminWebEnabled,
            _ => false
        };

        if (!isEnabled)
        {
            context.Result = new NotFoundObjectResult(new
            {
                error = $"Feature '{Feature}' is disabled.",
                code = "FEATURE_DISABLED"
            });
        }

        return Task.CompletedTask;
    }
}
