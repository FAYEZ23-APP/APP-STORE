START TRANSACTION;

UPDATE "Orders" o
SET "IdempotencyKey" = NULL
WHERE o."IdempotencyKey" IS NOT NULL
  AND o."IdempotencyKey" <> ''
  AND EXISTS (
      SELECT 1 FROM "Orders" k
      WHERE k."BuyerId" = o."BuyerId"
        AND k."IdempotencyKey" = o."IdempotencyKey"
        AND k."Id" < o."Id");

DROP INDEX "IX_Orders_BuyerId_IdempotencyKey";

CREATE UNIQUE INDEX "IX_Orders_BuyerId_IdempotencyKey" ON "Orders" ("BuyerId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL AND "IdempotencyKey" <> '';

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261030011003_MakeOrderIdempotencyIndexUnique', '10.0.5');

COMMIT;

