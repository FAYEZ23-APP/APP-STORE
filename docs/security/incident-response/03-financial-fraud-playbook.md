# Incident Response Playbook 03: Marketplace Financial & Pricing Fraud

> **Severity**: P1 / P2 (High to Critical)  
> **Trigger Events**: `SEC_FRAUD_PRICE_MANIPULATION`, `SEC_FRAUD_WALLET_TAMPERING`, `SEC_FRAUD_DUPLICATE_SETTLEMENT`  
> **Target Asset**: Financial Ledger, Order Subtotals, COD Escrow & Seller Wallets  

---

## 1. Trigger Scenarios
1. High volume of order submissions with tampered unit prices (sub-penny / zero-price attacks).
2. Race condition exploits attempting concurrent checkout beyond remaining inventory.
3. Exploitation of coupon discount stacking or negative subtotal manipulation.
4. Concurrent merchant payout requests attempting wallet balance overdraft.

---

## 2. Automated Defenses in Place
- **Server Authoritative Pricing**: Client-submitted unit prices, discounts, and delivery fees are discarded; backend calculates authoritative totals directly from the database.
- **Pessimistic Row-Level Locking (`xmax = 0` / RowVersion)**: Prevents double-spending of wallet balances and duplicate checkout of last available inventory.
- **COD Escrow Hold**: Funds collected upon delivery are held in Escrow until the 14-day statutory return window elapses.

---

## 3. Incident Commander Action Checklist
1. **Financial Anomaly Query**:
   ```sql
   -- Identify any orders created where total does not equal calculated items + delivery
   SELECT o."Id", o."FinalTotal", o."Subtotal", o."ShippingCost", o."DiscountAmount"
   FROM "Orders" o
   WHERE o."FinalTotal" != (o."Subtotal" + o."ShippingCost" - o."DiscountAmount");
   ```
   *Expected Result*: Exactly 0 rows.
2. **Seller Settlement Reconciliation**:
   ```sql
   -- Verify wallet balance matches ledger transaction sum
   SELECT s."Id", s."AvailableBalance", COALESCE(SUM(t."Amount"), 0) AS "LedgerSum"
   FROM "SellerProfiles" s
   LEFT JOIN "WalletTransactions" t ON t."SellerId" = s."Id"
   GROUP BY s."Id";
   ```
3. **If Discrepancy is Detected**:
   - Immediately freeze affected seller wallet (`Features:EnableVendorPayouts = false`).
   - Flag affected shipments in state `FlaggedForReview = true`.
   - Hold remittance disbursement to carrier or bank until audit completes.
