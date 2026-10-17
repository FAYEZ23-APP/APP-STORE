using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Marketplace.API.Filters;

/// <summary>
/// Runs the registered FluentValidation validator (if any) for every action argument.
/// On failure throws <see cref="ValidationException"/>, which the global middleware turns into a 400.
/// </summary>
public class ValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider _services;

    public ValidationFilter(IServiceProvider services)
    {
        _services = services;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (_services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument));
            if (!result.IsValid)
                throw new ValidationException(result.Errors);
        }

        await next();
    }
}
