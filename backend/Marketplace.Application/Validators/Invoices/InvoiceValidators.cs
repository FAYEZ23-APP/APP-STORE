using FluentValidation;
using Marketplace.Application.DTOs.Invoices;

namespace Marketplace.Application.Validators.Invoices;

public class GenerateInvoiceRequestValidator : AbstractValidator<GenerateInvoiceRequest>
{
    public GenerateInvoiceRequestValidator()
    {
        RuleFor(x => x.InvoiceType)
            .NotEmpty().WithMessage("InvoiceType is required.")
            .Must(t => string.Equals(t, "Receipt", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(t, "TaxInvoice", StringComparison.OrdinalIgnoreCase))
            .WithMessage("InvoiceType must be either 'Receipt' or 'TaxInvoice'.");
    }
}
