# Stage 2 — Test 04: Idempotency & Duplicate Order Prevention

## Test ID
`REG-STAGE2-004` (Method: `Test04_Idempotency_SameKeyReturnsSameOrder_DifferentKeyCreatesNew`)

## Objective
Verify that order creation idempotency safeguards prevent duplicate order records and duplicate inventory deductions when identical requests or retries are submitted with the same idempotency key.

## Environment & Target Safety
- **Database**: `MarketplaceMVP_test`
- **Target Safety**: Verified strictly on test database. Zero writes to `MarketplaceMVP`.

## Setup
1. Created test Buyer, Seller, and Product with `Stock = 10` and `Price = 80.00 EGP`.
2. Generated test idempotency key: `idem-0f37b98a...`.

## Execution Steps & Results

### Call 1: Initial Order Placement
- **Request**: Quantity = 2, IdempotencyKey = `idem-0f37b98a...`.
- **Actual Response**: Order `Id = 1`, Status = `Pending`, Total = `210.00 EGP`.
- **Database Check**: Product stock deducted from `10` to `8`.

### Call 2: Duplicate Request Submission (Retry with Same Key)
- **Request**: Identical payload, same IdempotencyKey = `idem-0f37b98a...`.
- **Actual Response**: Order `Id = 1` (Returns existing order immediately).
- **Database Verification**:
  - Exactly 1 order exists in `Orders` table for this idempotency key.
  - Zero duplicate shipments or items created.
  - **Product stock remained `8`** (NO second deduction occurred).

### Call 3: New Order Submission (Different Key)
- **Request**: Identical item and address, new IdempotencyKey = `different-9c12a...`.
- **Actual Response**: Order `Id = 2` (`Id != 1`).
- **Database Verification**:
  - Second order created with distinct ID.
  - Product stock deducted once more from `8` to `6`.

## Expected vs Actual Result
- **Expected**: Repeated submission with identical key returns cached/persisted order; no duplicate database entities; stock deducted only once. Submission with different key creates new order and deducts stock.
- **Actual**: All expectations confirmed on live PostgreSQL tables.

## Status
**PASS**

