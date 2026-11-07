using Marketplace.Application.DTOs.Privacy;
using Marketplace.Application.Interfaces;

namespace Marketplace.Infrastructure.Services;

/// <summary>
/// Electronic Processing Register under Egyptian Personal Data Protection Law 151/2020 (Article 8)
/// and Executive Regulations Decree 816/2025.
/// Provides a documented, auditable register of all platform personal data processing activities.
/// </summary>
public class PrivacyProcessingRegisterService : IPrivacyProcessingRegisterService
{
    public Task<PrivacyProcessingRegisterResponse> GetRegisterAsync()
    {
        var response = new PrivacyProcessingRegisterResponse
        {
            Platform = "Egypt Shop Marketplace Backend (.NET 10 / ASP.NET Core)",
            LegalFramework = "Egyptian Personal Data Protection Law 151/2020 & Executive Regulations Decree 816/2025",
            LastUpdatedUtc = DateTime.UtcNow,
            Activities = new List<ProcessingActivityEntry>
            {
                new()
                {
                    ActivityName = "Account Registration & Identity Authentication",
                    Purpose = "Provide user authentication, credential management, OTP verification, and profile management.",
                    LawfulBasis = "Contract Performance (Egyptian Civil Code & PDPL Art. 3) and Explicit Consent at signup.",
                    DataSubjectCategory = "Buyers, Sellers, Platform Administrators",
                    DataCategories = new() { "Full Name", "Email Address", "Phone Number", "Password Hash (PBKDF2/BCrypt)", "Two-Factor TOTP Secret (encrypted)", "Device Tokens" },
                    AuthorizedRecipients = new() { "Internal Auth Subsystem", "SMSMisr Gateway (OTP delivery)", "Resend/SMTP Gateway (Verification)" },
                    RetentionPeriod = "Account Lifetime + 30 days post-deletion grace period.",
                    DeletionOrAnonymizationPolicy = "Immediate anonymization upon verified deletion request; authentication credentials randomized and invalidated.",
                    SecurityMeasures = new() { "PBKDF2/BCrypt cryptographic hashing", "No plaintext credentials", "Single-use 6-digit OTPs expiring in 5 minutes", "TokenVersion instant invalidation", "LogMasking phone and email redaction" }
                },
                new()
                {
                    ActivityName = "Order Placement, Shipping & Delivery Fulfillment",
                    Purpose = "Process customer purchases, compute shipping costs, generate carrier waybills, and coordinate courier dispatch.",
                    LawfulBasis = "Contract Performance (Sale & Delivery Agreement).",
                    DataSubjectCategory = "Buyers, Delivery Couriers, Merchants",
                    DataCategories = new() { "Recipient Name", "Recipient Phone", "Governorate", "City", "Area", "Street/Building Details", "Coordinates", "Order Items", "COD Amount" },
                    AuthorizedRecipients = new() { "Assigned Logistics Carrier (e.g. Bosta)", "Fulfilling Merchant (Minimized PII only: First Name, City, Governorate)" },
                    RetentionPeriod = "5 Years from fiscal year-end (Mandatory tax & commercial retention under Egyptian Tax Law and Commercial Code).",
                    DeletionOrAnonymizationPolicy = "Buyer PII redacted upon account deletion (RecipientName = 'Deleted User', phone/street wiped); order items and financial totals preserved for tax compliance.",
                    SecurityMeasures = new() { "Field-level seller data minimization", "Carrier shipping label access audited via ISensitiveDataAccessAuditService", "LogMasking redaction", "403/404 tenant isolation" }
                },
                new()
                {
                    ActivityName = "Merchant Onboarding & Store Dispatch Operations",
                    Purpose = "Enable sellers to list products, receive order dispatches, coordinate warehouse pickup, and receive payouts.",
                    LawfulBasis = "Contract Performance (Merchant Marketplace Agreement).",
                    DataSubjectCategory = "Sellers / Merchants",
                    DataCategories = new() { "Store Name", "Dispatch Address", "Contact Phone Number", "Product Catalog", "Bank/Wallet Payout Details" },
                    AuthorizedRecipients = new() { "Platform Operations Team", "Integrated Courier Dispatch Fleet", "Banking/Payout Processors" },
                    RetentionPeriod = "Duration of active merchant partnership + 5 years for commercial financial records.",
                    DeletionOrAnonymizationPolicy = "Blocked if active products, in-transit shipments, or unpaid balances exist (409 Conflict); anonymized once obligations cleared.",
                    SecurityMeasures = new() { "Role-based authorization (Authorize(Roles = 'Seller'))", "Financial feature gating (Features:EnableVendorPayouts)", "Dispatch address audit logging" }
                },
                new()
                {
                    ActivityName = "Consumer Protection, Returns & Dispute Resolution",
                    Purpose = "Comply with Egyptian Consumer Protection Law 181/2018 (14-day & 30-day return rights) and manage dispute evidence.",
                    LawfulBasis = "Legal Obligation (Consumer Protection Law 181/2018) & Contract Performance.",
                    DataSubjectCategory = "Buyers, Sellers",
                    DataCategories = new() { "Return Reason", "Defect Photographs", "Dispute Evidentiary Documents", "Inspection Notes", "Refund Amounts" },
                    AuthorizedRecipients = new() { "Customer Support Team", "Dispute Resolution Administrators", "Consumer Protection Agency (CPA) on request" },
                    RetentionPeriod = "180 Days statutory dispute retention window; indefinite if placed on administrative Legal Hold.",
                    DeletionOrAnonymizationPolicy = "Uploaded evidence isolated in App_Data/private-uploads/disputes/; purged after 180 days unless IsLegalHold = true.",
                    SecurityMeasures = new() { "Private file storage outside web root", "Authenticated streaming endpoint with ownership check", "SkiaSharp EXIF/GPS metadata stripping", "Magic bytes signature validation" }
                },
                new()
                {
                    ActivityName = "Direct Marketing & Promotional Communications",
                    Purpose = "Deliver promotional SMS, push notifications, and marketing newsletters.",
                    LawfulBasis = "Explicit Freely-Given Consent (PDPL 151/2020 Art. 17).",
                    DataSubjectCategory = "Buyers",
                    DataCategories = new() { "Email Address", "Phone Number", "Marketing Consent Flag", "Consent Timestamp" },
                    AuthorizedRecipients = new() { "Internal Marketing Dispatcher", "SMSMisr Gateway", "Resend Marketing Services" },
                    RetentionPeriod = "Until consent is withdrawn or account is deleted.",
                    DeletionOrAnonymizationPolicy = "Consent flag set to false immediately upon withdrawal; phone/email unsubscribed from marketing processors.",
                    SecurityMeasures = new() { "Unchecked by default consent checkboxes", "Timestamped consent audit trail", "Immediate suppression on withdrawal" }
                },
                new()
                {
                    ActivityName = "Fraud Detection, COD Refusal Prevention & Security Audit",
                    Purpose = "Identify abusive behavior, prevent repeated cash-on-delivery refusals, enforce rate limits, and maintain security logs.",
                    LawfulBasis = "Legitimate Interest (Loss Prevention) & Legal Obligation (Cybersecurity & Audit).",
                    DataSubjectCategory = "All Platform Users",
                    DataCategories = new() { "IP Address", "User Agent", "COD Refusal Count", "Blacklist Flags", "HTTP Request Headers", "Audit Action Logs" },
                    AuthorizedRecipients = new() { "Platform Security Engineers", "Executive Management" },
                    RetentionPeriod = "90 Days for detailed operational logs; 1 year for COD refusal & abuse audit logs.",
                    DeletionOrAnonymizationPolicy = "Security logs sanitized to remove raw credentials, OTPs, and tokens; immutable audit entries preserved.",
                    SecurityMeasures = new() { "Centralized LogMasking.cs redaction", "Request/response logging middleware sanitization", "No sensitive data logging in EF Core", "Tamper-evident audit logs" }
                },
                new()
                {
                    ActivityName = "Statutory Tax, Accounting & Financial Audit Compliance",
                    Purpose = "Maintain financial ledger, tax records, invoice references, and COD settlement transactions.",
                    LawfulBasis = "Legal Obligation (Egyptian Tax Law & Commercial Books Law).",
                    DataSubjectCategory = "Buyers, Sellers",
                    DataCategories = new() { "Order Reference", "Invoice Number", "Transaction Amounts", "Tax Deductions", "Payment Method", "Delivery Timestamp" },
                    AuthorizedRecipients = new() { "Egyptian Tax Authority", "Statutory External Financial Auditors" },
                    RetentionPeriod = "5 Years from transaction fiscal year-end.",
                    DeletionOrAnonymizationPolicy = "Retained in read-only financial tables without blind cascade delete; customer PII anonymized while ledger entries remain immutable.",
                    SecurityMeasures = new() { "Database foreign key ON DELETE RESTRICT", "Feature flag gating for financial routes", "Immutable transaction ledgers" }
                }
            }
        };

        return Task.FromResult(response);
    }
}
