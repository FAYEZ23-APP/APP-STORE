using FluentValidation;
using Marketplace.Application.DTOs.Support;

namespace Marketplace.Application.Validators.Support;

public class CreateSupportTicketRequestValidator : AbstractValidator<CreateSupportTicketRequest>
{
    public CreateSupportTicketRequestValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200).WithMessage("Subject is required and cannot exceed 200 characters");
        RuleFor(x => x.Category).NotEmpty().MaximumLength(50).WithMessage("Category cannot exceed 50 characters");
        RuleFor(x => x.Priority).NotEmpty().MaximumLength(20).WithMessage("Priority cannot exceed 20 characters");
        RuleFor(x => x.InitialMessage).NotEmpty().MaximumLength(4000).WithMessage("Initial message is required and cannot exceed 4000 characters");
    }
}

public class AddTicketMessageRequestValidator : AbstractValidator<AddTicketMessageRequest>
{
    public AddTicketMessageRequestValidator()
    {
        RuleFor(x => x.Message).NotEmpty().MaximumLength(4000).WithMessage("Message cannot exceed 4000 characters");
        RuleFor(x => x.AttachmentUrl).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.AttachmentUrl));
    }
}

public class UpdateTicketStatusRequestValidator : AbstractValidator<UpdateTicketStatusRequest>
{
    public UpdateTicketStatusRequestValidator()
    {
        RuleFor(x => x.Status).NotEmpty().MaximumLength(30).WithMessage("Status is required and cannot exceed 30 characters");
    }
}
