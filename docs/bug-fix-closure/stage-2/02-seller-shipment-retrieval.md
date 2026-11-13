# Stage 2 — Test 02: Seller Shipment Retrieval Regression Verification

## Test ID
`REG-STAGE2-002` (Method: `Test02_SellerShipmentRetrieval_LoadsWave6Columns_WithIsolation`)

## Objective
Verify that `GET /api/shipments/seller` executes without throwing SQL missing-column exceptions (`column s.SlaCancelledAt does not exist` or `column oi.AcceptedQuantity does not exist`), maps `OrderItems` successfully, and preserves multi-tenant seller isolation without data leakage.

## Environment & Target Safety
- **Database**: `MarketplaceMVP_test`
- **Target Safety**: Strict read-only query isolation on test database. Zero access to `MarketplaceMVP`.

## Setup
1. Created Seller A (`seller_a_{guid}@test.eg`) and Seller B (`seller_b_{guid}@test.eg`).
2. Placed order for Seller A's product (Quantity = 2, Price = 100.00).
3. Placed order for Seller B's product.

## Actual Request
Execution via `ShipmentService.GetSellerShipmentsAsync(sellerA.Id)`:
```
GET /api/shipments/seller
Authorization: Bearer <Seller_A_Token>
```

## Actual Response
```json
[
  {
    "id": 1,
    "orderId": 1,
    "status": "Created",
    "trackingNumber": "TRK-100001",
    "deliveryMethod": "Courier",
    "deliveryCost": 50.00,
    "codAmount": 250.00,
    "isCodSettled": false,
    "recipientFirstName": "Buyer",
    "recipientGovernorate": "القاهرة",
    "recipientCity": "القاهرة",
    "items": [
      {
        "id": 1,
        "productId": 101,
        "productName": "Test Product",
        "quantity": 2,
        "unitPrice": 100.00,
        "weightGrams": 500
      }
    ]
  }
]
```

## Database & Model Verification
- Verified underlying `OrderItems` table was queried without exception.
- Verified `AcceptedQuantity = 0` and `RefusedQuantity = 0` loaded from database.
- Executed query for Seller B:
  - Seller B response contained only Seller B's shipments.
  - Zero cross-seller shipment leakage (`DoesNotContain` passed).

## Expected vs Actual Result
- **Expected**: HTTP 200 equivalent; returns list containing Seller A's shipment and items; no SQL syntax/missing column exceptions; strict seller isolation.
- **Actual**: Complete match. All assertions passed.

## Status
**PASS**

