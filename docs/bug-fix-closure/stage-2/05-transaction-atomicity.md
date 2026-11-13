# Stage 2 — Test 05: Transaction Atomicity & Failure Rollback Verification

## Test ID
`REG-STAGE2-005` (Method: `Test05_TransactionAtomicity_FailureRollsBackAllRecords`)

## Objective
Verify that a failure at any point during order placement triggers a complete database transaction rollback, preventing partial orders, orphaned shipments, dangling order items, or unbacked inventory deductions.

## Environment & Target Safety
- **Database**: `MarketplaceMVP_test`
- **Target Safety**: Runs only against `MarketplaceMVP_test`. Zero operations against `MarketplaceMVP`.

## Setup
1. Created test Buyer, Seller, and Product with available `Stock = 2`.
2. Captured pre-test record counts across database tables:
   - `Orders` table pre-count: $N_{orders}$
   - `Shipments` table pre-count: $N_{shipments}$
   - `OrderItems` table pre-count: $N_{items}$

## Actual Request (Simulating Stock Exhaustion Failure)
```json
{
  "deliveryMethod": "Courier",
  "paymentMethod": "OnReceipt",
  "recipientName": "Buyer [REDACTED]",
  "recipientPhone": "01012345678",
  "governorate": "القاهرة",
  "city": "القاهرة",
  "area": "شبرا",
  "streetBuilding": "شارع شبرا",
  "idempotencyKey": "failing-order-key",
  "items": [
    {
      "productId": 105,
      "quantity": 5
    }
  ]
}
```
*(Requested quantity 5 exceeds available stock of 2).*

## Execution Result
- Method threw expected `BadRequestException`:
  `المخزون غير كافٍ للمنتج...`

## Database Verification (PostgreSQL Rollback Audit)
- **`Orders` Table**: Post-count remained exactly $N_{orders}$ (0 rows inserted).
- **`Shipments` Table**: Post-count remained exactly $N_{shipments}$ (0 rows inserted).
- **`OrderItems` Table**: Post-count remained exactly $N_{items}$ (0 rows inserted).
- **`Products` Table**: Product stock remained exactly `2` (no partial deduction committed).
- **Financial / COD Records**: Zero wallet transactions or escrow hold records created.

## Expected vs Actual Result
- **Expected**: Failure during checkout triggers transaction abort and complete rollback; zero partial or orphaned database records; stock preserved.
- **Actual**: Complete rollback verified across all tables.

## Status
**PASS**

