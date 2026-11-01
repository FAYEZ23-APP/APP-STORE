using FluentValidation;
using Marketplace.Application.DTOs.Reviews;

namespace Marketplace.Application.Validators.Reviews;

public class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(x => x.ProductId)
            .GreaterThan(0).WithMessage("معرف المنتج غير صحيح.");

        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5).WithMessage("التقييم يجب أن يكون بين 1 و 5 نجوم.");

        RuleFor(x => x.Comment)
            .MaximumLength(1000).WithMessage("نص التقييم لا يمكن أن يتجاوز 1000 حرف.");

        RuleFor(x => x.ImageUrls)
            .Must(urls => urls == null || urls.Count <= 3)
            .WithMessage("لا يمكن إرفاق أكثر من 3 صور في التقييم الواحد.");
    }
}

public class UpdateReviewRequestValidator : AbstractValidator<UpdateReviewRequest>
{
    public UpdateReviewRequestValidator()
    {
        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5).WithMessage("التقييم يجب أن يكون بين 1 و 5 نجوم.");

        RuleFor(x => x.Comment)
            .MaximumLength(1000).WithMessage("نص التقييم لا يمكن أن يتجاوز 1000 حرف.");

        RuleFor(x => x.ImageUrls)
            .Must(urls => urls == null || urls.Count <= 3)
            .WithMessage("لا يمكن إرفاق أكثر من 3 صور في التقييم الواحد.");
    }
}

public class SellerReplyRequestValidator : AbstractValidator<SellerReplyRequest>
{
    public SellerReplyRequestValidator()
    {
        RuleFor(x => x.Reply)
            .NotEmpty().WithMessage("نص الرد مطلوب.")
            .MaximumLength(500).WithMessage("رد التاجر لا يمكن أن يتجاوز 500 حرف.");
    }
}

public class ReportReviewRequestValidator : AbstractValidator<ReportReviewRequest>
{
    public ReportReviewRequestValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("سبب الإبلاغ مطلوب.")
            .MaximumLength(100).WithMessage("سبب الإبلاغ لا يمكن أن يتجاوز 100 حرف.");

        RuleFor(x => x.Details)
            .MaximumLength(500).WithMessage("تفاصيل الإبلاغ لا يمكن أن تتجاوز 500 حرف.");
    }
}
