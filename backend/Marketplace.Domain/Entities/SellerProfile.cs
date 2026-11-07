using System.ComponentModel.DataAnnotations.Schema;

namespace Marketplace.Domain.Entities;

public class SellerProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string DispatchCity { get; set; } = string.Empty;
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }

    [NotMapped]
    public double? DispatchLatitude { get; set; }

    [NotMapped]
    public double? DispatchLongitude { get; set; }

    public string? CommercialRegisterNumber { get; set; }
    public string? TaxCardNumber { get; set; }
    public string? NationalIdNumber { get; set; }
    public string? KybDocumentUrl { get; set; }
    public string KybStatus { get; set; } = "Unverified";
    public string? KybRejectionReason { get; set; }
    public DateTime? KybVerifiedAt { get; set; }

    public User User { get; set; } = null!;
}
