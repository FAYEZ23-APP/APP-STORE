# Stage 2 — Test 03: Partial Delivery Calculations & Stock Restoration

## Test ID
`REG-STAGE2-003` (Method: `Test03_PartialDelivery_CalculatesCorrectQuantitiesAndRestoresStock`)

## Objective
Verify the Wave 6 partial delivery business logic:
1. Validation rule: `AcceptedQuantity + RefusedQuantity == Quantity`.
2. Quantity bounds enforcement: rejects invalid sums or exceeding quantities with `BadRequestException`.
3. Multi-quantity partial acceptance and refusal calculations.
4. COD amount recalculation (`AdjustedCodAmount = (AcceptedQuantity * UnitPrice) + DeliveryCost`).
5. Automatic restoration of refused quantity back into product inventory.
6. Shipment status update to `Delivered` and `IsPartiallyDelivered = true`.

## Environment & Target Safety
- **Database**: `MarketplaceMVP_test`
- **Target Safety**: Runs only against `MarketplaceMVP_test`. Zero modification to `MarketplaceMVP`.

## Setup
1. Created Seller, Buyer, and Product (`Stock = 10, Price = 100.00 EGP`).
2. Placed order with Quantity = 4 (Stock deducted to 6).
3. Retrieved created Shipment (`CodAmount = 450.00 EGP`, comprising 400.00 items + 50.00 delivery).

## Sub-Test Executions & Results

### Sub-Test A: Invalid Quantity Sum
- **Input**: `AcceptedQuantity = 2, RefusedQuantity = 1` (Sum = 3 != Ordered 4).
- **Actual Result**: Threw `BadRequestException: Accepted (2) + Refused (1) must equal total order quantity (4) for item 1`.
- **Verdict**: PASS

### Sub-Test B: Exceeding Quantity Sum
- **Input**: `AcceptedQuantity = 5, RefusedQuantity = 0` (Sum = 5 > Ordered 4).
- **Actual Result**: Threw `BadRequestException: Accepted (5) + Refused (0) must equal total order quantity (4) for item 1`.
- **Verdict**: PASS

### Sub-Test C: Valid Partial Delivery Execution
- **Input**: `AcceptedQuantity = 3, RefusedQuantity = 1` (Sum = 4 == Ordered 4).
- **Actual Result**:
  - `ProcessPartialDeliveryAsync` completed successfully.
  - `IsPartiallyDelivered`: `true`
  - `Status`: `Delivered`

## Database Verification
- **`OrderItems` Table**:
  - `AcceptedQuantity`: Updated to `3`
  - `RefusedQuantity`: Updated to `1`
- **`Shipments` Table**:
  - `IsPartiallyDelivered`: `true`
  - `AdjustedCodAmount`: `350.00 EGP` (`(3 * 100.00) + 50.00`)
  - `CodAmount`: `350.00 EGP`
  - `Status`: `Delivered`
  - `DeliveredAt`: Set to UTC timestamp
- **`Products` Table (Inventory Restoration)**:
  - Initial stock: `10`
  - After order: `6`
  - After partial delivery (1 refused item restored): `7` (`6 + 1`)
- **`AdminAuditLogs` Table**:
  - Action `PartialDeliveryProcessed` logged with admin ID, shipment tracking, and adjusted COD value.

## Status
**PASS**

