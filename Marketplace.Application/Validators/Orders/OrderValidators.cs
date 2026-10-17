using FluentValidation;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Validators.Users;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Orders;

public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator(IDeliveryProvider deliveryProvider)
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Cart cannot be empty.")
            .Must(items => items != null && items.Count > 0).WithMessage("Must provide at least one item.");

        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());

        RuleFor(x => x.DeliveryMethod)
            .NotEmpty().WithMessage("DeliveryMethod is required.")
            .IsEnumName(typeof(DeliveryMethod), caseSensitive: false)
            .WithMessage("DeliveryMethod must be 'Pickup' or 'Courier'.");

        RuleFor(x => x.PaymentMethod)
            .NotEmpty().WithMessage("PaymentMethod is required.")
            .IsEnumName(typeof(PaymentMethod), caseSensitive: false)
            .WithMessage("PaymentMethod must be 'OnReceipt'.");

        RuleFor(x => x.RecipientName)
            .NotEmpty().WithMessage("RecipientName is required.")
            .Length(2, 100).WithMessage("RecipientName must be between 2 and 100 characters.");

        RuleFor(x => x.RecipientPhone)
            .NotEmpty().WithMessage("RecipientPhone is required.")
            .Matches(EgyptianPhoneValidation.PhoneRegex)
            .WithMessage("RecipientPhone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");

        // Pickup rules: requires a valid PickupPointId
        When(x => string.Equals(x.DeliveryMethod, nameof(DeliveryMethod.Pickup), StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.PickupPointId)
                .NotEmpty().WithMessage("PickupPointId is required for Pickup delivery.")
                .MustAsync(async (pointId, ct) =>
                {
                    if (string.IsNullOrWhiteSpace(pointId)) return false;
                    var point = await deliveryProvider.GetPickupPointByIdAsync(pointId);
                    return point != null;
                })
                .WithMessage("Invalid PickupPointId.");
        });

        // Courier rules: requires City + structured address (Governorate, City, Area, StreetBuilding)
        When(x => string.Equals(x.DeliveryMethod, nameof(DeliveryMethod.Courier), StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.City)
                .NotEmpty().WithMessage("City is required for Courier delivery.")
                .Length(2, 100).WithMessage("City must be between 2 and 100 characters.")
                .MustAsync(async (city, ct) =>
                {
                    if (string.IsNullOrWhiteSpace(city)) return false;
                    return await deliveryProvider.IsValidCityAsync(city);
                })
                .WithMessage("Selected City is not supported by the delivery provider.");

            RuleFor(x => x.Governorate)
                .NotEmpty().WithMessage("Governorate is required for Courier delivery.")
                .Length(2, 100).WithMessage("Governorate must be between 2 and 100 characters.")
                .When(x => !string.IsNullOrWhiteSpace(x.Governorate) || string.IsNullOrWhiteSpace(x.AddressLine));

            RuleFor(x => x.Area)
                .NotEmpty().WithMessage("Area is required for Courier delivery.")
                .Length(2, 100).WithMessage("Area must be between 2 and 100 characters.")
                .When(x => !string.IsNullOrWhiteSpace(x.Area) || string.IsNullOrWhiteSpace(x.AddressLine));

            RuleFor(x => x.StreetBuilding)
                .NotEmpty().WithMessage("StreetBuilding is required for Courier delivery.")
                .Length(2, 300).WithMessage("StreetBuilding must be between 2 and 300 characters.")
                .When(x => !string.IsNullOrWhiteSpace(x.StreetBuilding) || string.IsNullOrWhiteSpace(x.AddressLine));
        });
    }
}

public class OrderItemRequestValidator : AbstractValidator<OrderItemRequest>
{
    public OrderItemRequestValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0).WithMessage("Valid ProductId is required.");
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be at least 1.");
    }
}

public class UpdateOrderStatusRequestValidator : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .IsEnumName(typeof(OrderStatus), caseSensitive: false)
            .WithMessage("Invalid order status.");
    }
}
