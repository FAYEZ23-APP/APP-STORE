using FluentValidation;
using Marketplace.Application.DTOs.Admin;

namespace Marketplace.Application.Validators.Admin;

public class UpdateUserStatusRequestValidator : AbstractValidator<UpdateUserStatusRequest>
{
    public UpdateUserStatusRequestValidator()
    {
        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithMessage("سبب تعديل حالة المستخدم يجب ألا يتجاوز 500 حرف.");
    }
}

public class AddCodBlacklistRequestValidator : AbstractValidator<AddCodBlacklistRequest>
{
    public AddCodBlacklistRequestValidator()
    {
        RuleFor(x => x.Phone)
            .NotEmpty()
            .WithMessage("رقم الهاتف مطلوب لإدراجه في قائمة الحظر.")
            .MaximumLength(30)
            .WithMessage("رقم الهاتف يجب ألا يتجاوز 30 حرفاً.");

        RuleFor(x => x.Reason)
            .NotEmpty()
            .WithMessage("سبب الحظر أو الإدراج مطلوب.")
            .MaximumLength(500)
            .WithMessage("سبب الحظر يجب ألا يتجاوز 500 حرف.");
    }
}
