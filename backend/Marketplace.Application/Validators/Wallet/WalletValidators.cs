using FluentValidation;
using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Validators.Users;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Wallet;

public class CreatePayoutRequestValidator : AbstractValidator<CreatePayoutRequest>
{
    public CreatePayoutRequestValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(50m)
            .WithMessage("الحد الأدنى لطلب السحب هو 50 ج.م.");

        RuleFor(x => x.Method)
            .NotEmpty().WithMessage("طريقة السحب مطلوبة.")
            .IsEnumName(typeof(PayoutMethod), caseSensitive: false)
            .WithMessage("طريقة السحب غير صحيحة. الخيارات المتاحة: VodafoneCash أو InstaPay أو BankTransfer.");

        RuleFor(x => x.DestinationAccount)
            .NotEmpty().WithMessage("بيانات الحساب / رقم التحويل مطلوبة.");

        When(x => string.Equals(x.Method, nameof(PayoutMethod.VodafoneCash), StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.DestinationAccount)
                .Must(EgyptianPhoneValidation.IsValid)
                .WithMessage("رقم محفظة فودافون كاش يجب أن يكون رقم هاتف مصري صحيح (مثال: 01012345678).");
        });

        When(x => string.Equals(x.Method, nameof(PayoutMethod.InstaPay), StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.DestinationAccount)
                .MinimumLength(3)
                .MaximumLength(100)
                .WithMessage("عنوان InstaPay يجب أن يكون صحيحاً.");
        });
    }
}

public class ProcessPayoutRequestValidator : AbstractValidator<ProcessPayoutRequest>
{
    public ProcessPayoutRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("الحالة مطلوبة.")
            .Must(s => string.Equals(s, nameof(PayoutStatus.Completed), StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(s, nameof(PayoutStatus.Rejected), StringComparison.OrdinalIgnoreCase))
            .WithMessage("الحالة يجب أن تكون 'Completed' أو 'Rejected'.");
    }

public class SettleCodRequestValidator : AbstractValidator<SettleCodRequest>
{
    public SettleCodRequestValidator()
    {
        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}

public class AdminSettleCodRequestValidator : AbstractValidator<AdminSettleCodRequest>
{
    public AdminSettleCodRequestValidator()
    {
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("???? ???? ?????? ?????? ?????? ????? ???????.")
            .MaximumLength(100);

        RuleFor(x => x.TotpCode)
            .NotEmpty().WithMessage("??? ???????? ???????? (TOTP) ????? ?????? ????? ???????.")
            .Matches("^[0-9]{6}$").WithMessage("??? ???????? ???????? ??? ?? ????? ?? 6 ?????.");

        RuleFor(x => x.SettlementReference)
            .NotEmpty().WithMessage("????? ??????? ?????? ???? ????? ??????.")
            .MinimumLength(5).WithMessage("????? ??????? ??? ??? ??? ?? 5 ????.")
            .MaximumLength(100).WithMessage("????? ??????? ??? ??? ?????? 100 ???.");

        RuleFor(x => x.ReceivedAmount)
            .GreaterThan(0).WithMessage("?????? ?????? ??????? ?????? ??? ?? ???? ???? ?? ?????.");

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
}
