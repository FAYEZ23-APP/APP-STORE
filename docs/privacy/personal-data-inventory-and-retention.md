# Egypt Shop — Personal Data Inventory & Statutory Retention Matrix
**Legal Framework**: Egyptian Personal Data Protection Law (PDPL) No. 151 of 2020 & Executive Regulations Decree No. 816 of 2025  
**System**: Egypt Shop Marketplace Backend (ASP.NET Core / .NET 10 / PostgreSQL)  
**Date**: November 2026  

---

## 1. Comprehensive Personal Data Inventory

| # | Data Category | Data Fields Collected | Purpose of Processing | Lawful Basis (PDPL Art. 3) | Data Subject | Authorized Recipients | Storage Location | Retention Period | Deletion / Anonymization Policy |
|---|---------------|----------------------|-----------------------|----------------------------|--------------|-----------------------|------------------|------------------|---------------------------------|
| 1 | **Users & Authentication** | Full Name, Email, Phone, PasswordHash (PBKDF2/BCrypt), TwoFactorSecret, TokenVersion, Role | Authentication, credential lifecycle, account recovery, security gating | Contract Performance & Consent | Buyers, Sellers, Admins | Internal Auth Subsystem, SMSMisr (OTP), Resend (Verification) | PostgreSQL `Users`, `VerificationCodes`, `ExternalLogins` | Account Lifetime + 30 days grace | Instant user anonymization (`Name = 'Deleted User'`, `Email = null`, `Phone = null`, random password hash, `TokenVersion++`) |
| 2 | **User Addresses** | Label, RecipientName, RecipientPhone, Governorate, City, Area, StreetBuilding, Building, Floor, Apartment, Landmark, Latitude, Longitude | Saved delivery destinations for customer convenience | Contract Performance | Buyers | Fulfilling Carrier, Buyer | PostgreSQL `UserAddresses` | Until deleted by user or account erasure | Hard-deleted upon account deletion request |
| 3 | **Orders** | RecipientName, RecipientPhone, Governorate, City, Area, StreetBuilding, Building, Floor, Apartment, Landmark, Latitude, Longitude, Order Items, TotalAmount, Status | Order fulfillment, COD collection, merchant dispatch, invoicing | Contract Performance & Legal Obligation (Tax Law) | Buyers, Merchants | Assigned Logistics Partner (e.g. Bosta), Fulfilling Merchant (Minimized PII only) | PostgreSQL `Orders`, `OrderItems` | **5 Years from fiscal year-end** (Mandatory statutory tax retention) | Preserved for financial audit; buyer PII scrubbed upon deletion (`RecipientName = 'Deleted User'`, phone & street cleared) |
| 4 | **Shipments & Logistics** | TrackingNumber, Status, DeliveryCost, CodAmount, Governorate, City, ReturnReason, Coordinates | Parcel dispatch, courier tracking, COD settlement escrow | Contract Performance | Buyers, Merchants, Couriers | Integrated Logistics Partner, Internal Fulfillment Team | PostgreSQL `Shipments` | **5 Years** (Commercial audit & carrier reconciliation) | Retained with order; recipient contact details scrubbed upon user erasure |
| 5 | **Seller Dispatch Profiles** | StoreName, DispatchCity, DispatchAddress, ContactPhone | Courier pickup coordination, marketplace seller identification | Contract Performance | Sellers | Assigned Logistics Carriers, Operations Admin | PostgreSQL `SellerProfiles` | Duration of partnership + 5 years | Anonymized upon verified seller account deletion once all financial obligations are cleared |
| 6 | **Reviews & Ratings** | Rating, Comment, Review Defect Images, ProductId | Public consumer reviews, product feedback | Consent & Legitimate Interest | Buyers | Public platform visitors, Merchants | PostgreSQL `Reviews` | Public lifetime | Display name anonymized to "Deleted User"; uploaded images scrubbed upon user deletion |
| 7 | **Returns & Disputes** | Reason, DefectImageUrl, DisputeEvidenceUrlsJson, Status, RefundAmount, Inspection Notes | Exercising legal 14/30-day return rights under Consumer Protection Law 181/2018 | Legal Obligation & Contract Performance | Buyers, Sellers | Customer Support, Dispute Administrators | PostgreSQL `ReturnRequests`, `UploadedFiles` (Private) | **180 Days** post-resolution; indefinite if placed on administrative Legal Hold | Private dispute files isolated in `App_Data/private-uploads/disputes/`; purged after retention unless `IsLegalHold = true` |
| 8 | **Wallet & Financial Ledgers** | Balance, PendingBalance, Transaction Amount, Type, Reference, Bank Account / Vodafone Cash numbers | Store credit management, merchant escrow payouts, COD clawbacks | Legal Obligation (Egyptian Commercial Code & Tax Law) | Buyers, Sellers | Banking/Payout Gateways, Internal Accounting, Egyptian Tax Authority | PostgreSQL `VendorWallets`, `WalletTransactions`, `PayoutRequests`, `BuyerWallets` | **5 Years** from transaction date | Immutable ledger; account deletion blocked if non-zero balance exists (409 Conflict) |
| 9 | **Push Notifications & Devices** | Exponent Push Token, Platform, DeviceId, DeviceName, LastUsedAt | Push alerts for order dispatch, shipment status, returns | Consent | Buyers, Sellers | Expo / FCM Push Gateway | PostgreSQL `UserDeviceTokens`, `RefreshTokens` | Active session lifetime | Tokens revoked and deleted immediately upon account deletion or logout |
| 10 | **Audit & Security Logs** | AdminId, Action, EntityType, EntityId, Details, IP, UserAgent, CorrelationId | Regulatory accountability, fraud detection, security traceability | Legal Obligation & Legitimate Interest | Platform Administrators, Users | Security Engineers, Regulatory Auditors | PostgreSQL `AdminAuditLogs`, Structured Serilog Files | **1 Year** for security audits; **90 days** for detailed HTTP telemetry | Sanitized via `LogMasking.cs` (no raw passwords, OTPs, or auth tokens); immutable records retained |
| 11 | **Data Subject Rights Requests** | RequestType, Status, DueDate (6 Egyptian working days), ExportToken, ProcessorSyncStatus | Compliance with PDPL Law 151/2020 Rights Requests | Legal Obligation | Requesting Data Subjects | Internal DPO / Privacy Administration | PostgreSQL `PrivacySubjectRequests` | **2 Years** from completion for regulatory inspection | Retained as proof of legal compliance |
| 12 | **Processor Deletion Logs** | ProcessorName, ActionRequested, Status, ResponseMessage, DispatchedAt, AcknowledgedAt | Verifiable third-party processor deletion tracking | Legal Obligation | Deleted Users | Internal DPO / Operations | PostgreSQL `ProcessorDeletionLogs` | **2 Years** | Retained as immutable proof of third-party propagation |
| 13 | **Privacy Breach Incident Logs** | IncidentRef, Title, DiscoveryTimestamp, CenterNotificationDeadline (72h), Severity, Containment, CenterRef | Security breach disclosure tracking under Decree 816/2025 | Legal Obligation | Platform Security Team, Affected Users | Personal Data Protection Center, Affected Data Subjects | PostgreSQL `PrivacyIncidentLogs` | **5 Years** | Retained for regulatory inspection by the Center |

---

## 2. Legal Retention & Accounting Integrity Classification

All stored data is classified into one of four statutory handling categories:

### Category A: Eligible for Immediate Deletion Upon Request
- Saved User Addresses (`UserAddresses`)
- Active Refresh Tokens & Session Cookies (`RefreshTokens`)
- Device Push Notification Registrations (`UserDeviceTokens`)
- Verification OTP Codes (`VerificationCodes`)
- Wishlist items (`WishlistItems`)
- User in-app notifications (`UserNotifications`)
- Marketing consent records (withdrawn immediately)

### Category B: Eligible for Anonymization / Pseudonymization
- User Account (`Users`): `Name` -> `'Deleted User'`, `Email` -> `null`, `Phone` -> `null`, `PasswordHash` -> randomized unguessable hash, `TokenVersion++`, `IsActive = false`.
- Customer Reviews (`Reviews`): review text retained for product rating statistics, author displayed as anonymous deleted user, embedded upload URLs purged.
- Seller Profiles (`SellerProfiles`): `ContactPhone` -> `null`, `DispatchAddress` -> `null`.

### Category C: Temporarily Retained Under Legal or Operational Basis
- **Orders, Shipments, and OrderItems**: Retained for **5 years** to satisfy Egyptian Tax Law and the Commercial Books Code. Recipient PII (`RecipientName`, `RecipientPhone`, `StreetBuilding`) is scrubbed, while Governorate, City, Items, and Financial Totals remain intact.
- **Wallet & Payout Transactions**: Retained for **5 years** as immutable financial records.
- **Audit Logs (`AdminAuditLogs`)**: Retained for **1 year** to ensure security traceability.

### Category D: Subject to Active Dispute, Investigation, or Legal Hold
- Return defect photos and dispute evidence with `IsLegalHold = true`.
- Deletion is prohibited while an active return or dispute is pending (enforced by 409 Conflict check in `DELETE /api/users/me`).
- Once released from legal hold, files expire after the 180-day dispute window.

---

## 3. Statutory SLA & Breach Notification Deadlines

1. **Data Subject Rights Request SLA (PDPL 151/2020)**:
   - **Deadline**: **6 Egyptian working days**.
   - **Working Days Calculation**: Sunday through Thursday. Friday and Saturday are official weekly rest days in Egypt and are excluded from the countdown.
   - **Calculation Utility**: `EgyptianCalendarUtils.CalculateWorkingDaysDueDate(submittedAt, 6)`.
   - **Tracking**: Tracked on `PrivacySubjectRequest.DueDate` with administrative visibility, overdue alerts, and review notes.

2. **Personal Data Protection Center Breach Notification (Decree 816/2025)**:
   - **Deadline**: **72 hours** from becoming aware of a qualifying privacy security breach.
   - **Incident Logging**: `POST /api/admin/privacy/incidents` calculates `CenterNotificationDeadline = DiscoveryTimestamp.AddHours(72)`.
   - **Reporting Dossier**: `GET /api/admin/privacy/incidents/{id}/report` generates the formal regulatory notification dossier containing incident reference, compromised categories, containment actions, and remediation status.
   - **Affected User Notification**: Required without undue delay when breach poses high risk to data subject rights.

---

## 4. Third-Party Processor Deletion Propagation

When an account is deleted via `DELETE /api/users/me`, deletion events are automatically propagated to external processors via `IThirdPartyProcessorDeletionService`:

1. **Delivery Carrier (e.g. Bosta / DevCarrier)**:
   - Action: `AnonymizeRecipientAndAddressData`
   - Purpose: Erase customer contact and address data from carrier fulfillment caches.
2. **SMS Gateway (e.g. SMSMisr)**:
   - Action: `SuppressAndPurgePhoneNumber`
   - Purpose: Remove phone number from promotional and transactional contact directories.
3. **Email Gateway (e.g. Resend / Transactional SMTP)**:
   - Action: `UnsubscribeAndSuppressEmail`
   - Purpose: Suppress email from marketing lists and delivery pools.
4. **Cloud / Object File Storage**:
   - Action: `PurgePersonalUploadedDocuments`
   - Purpose: Purge personal profile pictures and unheld dispute evidence files.

All dispatches are recorded in `ProcessorDeletionLogs` with retry support via `POST /api/admin/privacy/processor-deletion/{id}/retry`.
