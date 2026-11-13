# Stage 2 — Test 01: COD Order Creation Regression Verification

## Test ID
`REG-STAGE2-001` (Method: `Test01_CodOrderCreation_Succeeds_AndPersistsWave6Columns`)

## Objective
Reproduce the original checkout scenario that previously caused `HTTP POST /api/orders` to fail with `500 (Internal Server Error)` on `CheckoutPage.jsx`. Verify that a Cash on Delivery (COD/OnReceipt) order with Courier delivery succeeds end-to-end and correctly initializes the Wave 6 columns (`AcceptedQuantity` and `RefusedQuantity`) on the `OrderItems` table.

## Environment & Target Safety
- **Database**: `MarketplaceMVP_test` (PostgreSQL 18 on port 5432)
- **Target Safety**: `current_database()` resolved to `MarketplaceMVP_test`. Verified by `AppDbContext.AssertSafeForDestructiveOperations()`. Zero writes to `MarketplaceMVP`.

## Setup
1. Created isolated test Buyer: `buyer_{guid}@test.eg` with verified email/phone.
2. Created isolated test Seller: `seller_{guid}@test.eg` with active `SellerProfile` (DispatchCity: "الجيزة").
3. Seeded Category and Product: `Test Product {guid}` with `Price = 200.00 EGP`, `Stock = 10`, `WeightGrams = 500`.

## Actual Request
```json
{
  "deliveryMethod": "Courier",
  "paymentMethod": "OnReceipt",
  "recipientName": "Buyer [REDACTED]",
  "recipientPhone": "01012345678",
  "governorate": "القاهرة",
  "city": "القاهرة",
  "area": "مدينة نصر",
  "streetBuilding": "شارع عباس العقاد",
  "pickupPointId": null,
  "idempotencyKey": "d6be091d-40cf-4105-932e-9a9a1f48e598",
  "items": [
    {
      "productId": 106,
      "quantity": 1
    }
  ]
}
```

## Actual Response
```json
{
  "id": 1,
  "status": "Pending",
  "itemsSubtotal": 200.00,
  "deliveryCost": 50.00,
  "discountAmount": 0.00,
  "walletAmountUsed": 0.00,
  "totalAmount": 250.00
}
```

## Database Verification (PostgreSQL Query on TEST_DB)
- **Orders Table**:
  - `Id`: Valid integer (> 0)
  - `Status`: `Pending`
  - `PaymentMethod`: `OnReceipt`
  - `TotalAmount`: `250.00`
- **Shipments Table**:
  - `SellerId`: Matched test seller
  - `CodAmount`: `250.00` (Equal to Order TotalAmount)
  - `DeliveryCost`: `50.00`
  - `Status`: `Created`
- **OrderItems Table (Wave 6 Verification)**:
  - `ProductId`: Matched product
  - `Quantity`: `1`
  - `UnitPrice`: `200.00`
  - `AcceptedQuantity`: `0` (Correct initial default)
  - `RefusedQuantity`: `0` (Correct initial default)
  - `ShipmentId`: Matched created shipment
- **Inventory Verification**:
  - Product stock deducted atomically from `10` to `9`.

## Expected vs Actual Result
- **Expected**: Order created successfully with status 201/200; exactly 1 order, 1 shipment, 1 item; `AcceptedQuantity = 0`, `RefusedQuantity = 0`; stock deducted by 1.
- **Actual**: All expected values verified via live PostgreSQL queries on `MarketplaceMVP_test`.

## Status
**PASS**

