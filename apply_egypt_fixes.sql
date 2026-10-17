-- 1. UserConsents: alter foreign key constraint to ON DELETE RESTRICT
ALTER TABLE "UserConsents" DROP CONSTRAINT IF EXISTS "FK_UserConsents_Users_UserId";
ALTER TABLE "UserConsents" ADD CONSTRAINT "FK_UserConsents_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;

-- 2. Drop column defaults on Orders and UserAddresses
ALTER TABLE "Orders" ALTER COLUMN "Governorate" DROP DEFAULT;
ALTER TABLE "Orders" ALTER COLUMN "Area" DROP DEFAULT;
ALTER TABLE "Orders" ALTER COLUMN "StreetBuilding" DROP DEFAULT;

ALTER TABLE "UserAddresses" ALTER COLUMN "Governorate" DROP DEFAULT;
ALTER TABLE "UserAddresses" ALTER COLUMN "Area" DROP DEFAULT;
ALTER TABLE "UserAddresses" ALTER COLUMN "StreetBuilding" DROP DEFAULT;

-- 3. Replace any 'وسط البلد' in legacy rows with 'غير محدد'
UPDATE "Orders" SET "Area" = 'غير محدد' WHERE "Area" = 'وسط البلد';
UPDATE "UserAddresses" SET "Area" = 'غير محدد' WHERE "Area" = 'وسط البلد';

-- 4. Backfill CodAmount for existing OnReceipt/CashOnDelivery shipments and drop default
UPDATE "Shipments" s
SET "CodAmount" = COALESCE((
    SELECT SUM(oi."UnitPrice" * oi."Quantity")
    FROM "OrderItems" oi
    WHERE oi."ShipmentId" = s."Id"
), 0) + s."DeliveryCost"
FROM "Orders" o
WHERE s."OrderId" = o."Id"
  AND o."PaymentMethod" IN ('OnReceipt', 'CashOnDelivery');

ALTER TABLE "Shipments" ALTER COLUMN "CodAmount" DROP DEFAULT;
