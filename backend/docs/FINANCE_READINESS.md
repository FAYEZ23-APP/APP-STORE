# Financial Architecture & Production Readiness Guide

This document details the financial architecture, Cash on Delivery (COD) escrow lifecycle, ledger invariants, mathematical precision rules, and legal/accounting pre-conditions required before enabling financial features (`Features:EnableWallet`, `Features:EnableVendorPayouts`, `Features:EnableCoupons`) in Production.

> [!CAUTION]
> In accordance with platform governance, financial features default to `false` in all environments. Enabling them in Production requires setting `Features:AllowFinancialInProduction=true` in addition to the specific feature flag. The backend enforces this with startup fail-fast guards.

---

## 1. Inventory of Platform Money Flows

### A. Buyer Store Credit Wallet (`BuyerWallets`)
| Flow / Event | Direction | Trigger | Auth Role | Description |
|---|---|---|---|---|
| `RefundCredit` | **Credit (+)** | Return request marked `Approved` by Admin or Seller | System / Admin | Refund for returned item credited directly to buyer store credit balance. |
| `Cashback` | **Credit (+)** | Promotional campaign or loyalty credit | System / Admin | Platform incentives credited to buyer account. |
| `OrderRedemption` | **Debit (-)** | Buyer selects `useWalletBalance=true` at checkout | Buyer | Deducts up to available balance or total order payable amount. |

### B. Vendor / Seller Wallet (`VendorWallets`) & COD Escrow Lifecycle
| Flow / Event | Direction | Trigger | Auth Role | Description |
|---|---|---|---|---|
| `COD_EscrowHold` | **Hold in Pending (+)** | Shipment status transitions to `Delivered` | System / Carrier webhook | Net earnings (subtotal minus commission) are placed into `PendingBalance`. Available `Balance` remains unchanged to prevent liquidity deficit before cash remittance. |
| `Commission` | **Debit (-)** | Shipment status transitions to `Delivered` | System | Platform commission fee recorded immediately upon delivery. |
| `COD_EscrowRelease` | **Transfer (Pending -> Balance)** | Carrier cash remittance confirmed (`POST /api/admin/shipments/{id}/settle-cod` or carrier webhook) | Admin (with Step-Up) / Carrier | Moves net earnings from `PendingBalance` to available `Balance`, enabling withdrawal. |
| `Payout Request` | **Hold** | Seller submits `POST /api/wallet/payout-request` | Seller | Moves requested amount from `Balance` to `PendingBalance`. |
| `Payout Completed` | **Debit (-)** | Admin approves `POST /api/admin/wallet/payouts/{id}/process` | Admin | Clears `PendingBalance`; funds disbursed via Vodafone Cash, InstaPay, or Bank Transfer. |
| `Payout Rejected` | **Release (+)** | Admin rejects payout request | Admin | Returns held amount from `PendingBalance` back to `Balance`. |
| `Refund` | **Debit (-)** | Return request resolved before COD settlement | Seller / Admin | Debits refund amount from seller available balance. |
| `Clawback` | **Debit (-)** | Return request resolved after COD settlement | Seller / Admin | Debits refund amount from seller available balance with explicit ledger classification. Cannot produce a negative balance without an explicit administrative override. |

### C. Promotional Discounts (`Coupons`)
| Type | Computation | Constraints | Auth Role |
|---|---|---|---|
| **Percentage Discount** | `Subtotal * (DiscountValue / 100)` | Capped by `MaxDiscountAmount` if specified | Seller (own products) or Admin (platform-wide) |
| **Fixed Amount Discount** | `Min(DiscountValue, ApplicableSubtotal)` | Cannot exceed applicable items subtotal | Seller (own products) or Admin (platform-wide) |

---

## 2. Technical Architecture & Ledger Invariants

### A. Strict Decimal Arithmetic & Documented Rounding Rule
- **Type Usage**: All monetary amounts across Domain entities, DTOs, and database tables use fixed-point decimal (`decimal` in C#, `numeric(18,2)` in PostgreSQL). Floating-point types (`float`, `double`) are prohibited for financial calculations.
- **Documented Rounding Rule**: Financial calculations use symmetric half-up rounding to two decimal places:
  ```csharp
  Math.Round(amount, 2, MidpointRounding.AwayFromZero);
  ```
  Fractions greater than or equal to 0.005 round up to the nearest piastre (0.01 EGP).
- **Currency**: Egyptian Pound (`ج.م` / `EGP`).

### B. Append-Only Ledger Design
- The platform maintains append-only transaction tables:
  - `BuyerWalletTransactions`: tracks buyer credits and debits with `OrderId`, `ReturnRequestId`, `Amount`, and `Type`.
  - `WalletTransactions`: tracks vendor transactions with `OrderId`, `ShipmentId`, `Amount`, `Type`, and human-readable `Description`.
- Ledger records are immutable: rows are not updated or deleted. Adjustments are written as compensating transaction entries (`Refund`, `Clawback`).

### C. Ledger Invariant Equations
At all times:
1. `VendorWallet.Balance == SUM(WalletTransactions.Amount WHERE Type IN (OrderSettlement, COD_EscrowRelease, Refund, Clawback, Payout_Refund)) - SUM(PayoutRequests.Amount WHERE Status = Completed)`
2. `VendorWallet.PendingBalance == SUM(WalletTransactions.Amount WHERE Type = COD_EscrowHold) - SUM(WalletTransactions.Amount WHERE Type = COD_EscrowRelease) + SUM(PayoutRequests.Amount WHERE Status = Pending)`
3. `VendorWallet.Balance >= 0` (unless an explicit `AdminOverride` was approved during a post-settlement return clawback).

### D. Concurrency & Step-Up Security
- **Atomic Concurrency**: COD settlement uses PostgreSQL row-level locks (`SELECT 1 FROM "Shipments" WHERE "Id" = @id FOR UPDATE`) inside an explicit transaction. Parallel settlement requests for the same shipment result in exactly one execution, with concurrent callers rejected.
- **Admin Step-Up Authentication**:
  - Requires admin password verification.
  - Requires RFC 6238 TOTP verification (Google Authenticator / standard authenticator app).
  - Mandatory carrier settlement reference (minimum 5 characters).
  - Actual received cash amount.
  - Exactly one `AdminAuditLog` row recorded in the same database transaction.
- **Discrepancy Review Protocol**: If `ReceivedAmount != CodAmount`, the shipment is marked `FlaggedForReview = true`, audit details are recorded, and funds remain held in escrow without automatic release.
- **Return Request Lockout**: Settlements are rejected if an open return request (`Pending` or `Approved`) exists for the shipment.

---

## 3. Open Questions for Legal Counsel and External Accountant

### A. Questions for Platform Legal Counsel
1. **Escrow Custody Classification**: Under Central Bank of Egypt (CBE) Law 194/2020 and Payment Service Provider regulations, does holding cash on delivery funds in escrow for 3 to 14 days before merchant disbursement constitute a regulated payment facilitation / escrow activity requiring CBE licensing, or does it qualify as standard marketplace settlement intermediary under consumer protection provisions?
2. **Merchant Clawback Enforceability**: Under Egyptian civil and commercial law, are contractual terms permitting platform clawbacks against merchant balances for customer returns filed within the statutory 14-day window (Law 181/2018) enforceable? How should negative balance recovery be structured if a merchant ceases platform trading?
3. **Statutory Return Window Variations**: CPA Law 181/2018 mandates 14 days for general consumer returns, but 30 days for defective products. Should the COD escrow hold period distinguish between return reasons, or should insurance/reserve mechanisms cover days 15 through 30?

### B. Questions for External Accountant & Tax Advisor
1. **Platform Revenue Recognition Timing**: Under Egyptian Accounting Standards (EAS), does platform commission revenue recognize upon shipment delivery (`Delivered`), or upon carrier cash remittance settlement?
2. **Electronic Invoicing (منظومة الفاتورة الإلكترونية)**: At what exact trigger must the electronic tax invoice (with 14% VAT) be transmitted to the Egyptian Tax Authority (ETA)? Does the invoice issue against the merchant for the commission fee, or against the buyer?
3. **Carrier Remittance Reconciliation**: Carrier bank transfers arrive in aggregated bulk amounts with remittance sheets. What specific matching metadata (carrier manifest ID, bank transaction reference, shipment tracking number) is legally required for tax audit defense during ETA inspections?

---

## 4. Conditions Required to Enable Vendor Payouts

Before turning `Features:EnableVendorPayouts=true` or `Features:EnableWallet=true` on in Production, all of the following conditions must be satisfied:

1. **Merchant Verification (KYC)**:
   - Valid Commercial Register (سجل تجاري) and Tax Card (بطاقة ضريبية) on file and verified.
   - Bank account, InstaPay address, or mobile cash wallet ownership verified against company/merchant identity.
2. **Carrier SLA & Reconciliation Integration**:
   - Formal bilateral service contract signed with the shipping carrier establishing maximum 72-hour cash remittance cycles.
   - Carrier automated settlement webhook or daily signed remittance spreadsheet upload.
3. **Legal & Accounting Sign-Off**:
   - Written legal opinion from counsel on CBE regulatory classification.
   - Written memorandum from certified public accountant on ETA electronic invoice automation and VAT compliance.
4. **Operational Safeguards**:
   - Dual-admin approval enabled for any individual payout request exceeding `10,000 ج.م`.
   - Per-merchant daily payout limit enforced (`50,000 ج.م`).
   - Reserve fund / security deposit established to cover post-settlement customer return clawbacks.
