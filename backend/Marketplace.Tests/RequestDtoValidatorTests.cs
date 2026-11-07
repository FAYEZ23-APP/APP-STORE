using FluentValidation;
using Marketplace.Application;
using Xunit;

namespace Marketplace.Tests;

public class RequestDtoValidatorTests
{
    [Fact]
    public void EveryRequestDto_MustHaveFluentValidationValidator()
    {
        var appAssembly = typeof(DependencyInjection).Assembly;

        var requestTypes = appAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && t.Name.EndsWith("Request") && (t.Namespace?.StartsWith("Marketplace.Application.DTOs") ?? false))
            .ToList();

        Assert.NotEmpty(requestTypes);

        var validatedTypes = new HashSet<Type>();
        foreach (var type in appAssembly.GetTypes().Where(t => t.IsClass && !t.IsAbstract))
        {
            var cur = type;
            while (cur != null && cur != typeof(object))
            {
                if (cur.IsGenericType && cur.GetGenericTypeDefinition() == typeof(AbstractValidator<>))
                {
                    validatedTypes.Add(cur.GetGenericArguments()[0]);
                }
                cur = cur.BaseType;
            }
        }

        var missingValidators = requestTypes
            .Where(reqType => !validatedTypes.Contains(reqType))
            .Select(reqType => reqType.FullName ?? reqType.Name)
            .OrderBy(name => name)
            .ToList();

        Assert.True(
            missingValidators.Count == 0,
            $"The following {missingValidators.Count} Request DTO(s) do not have a FluentValidation AbstractValidator<T>:\n" +
            string.Join("\n", missingValidators));
    }
}
