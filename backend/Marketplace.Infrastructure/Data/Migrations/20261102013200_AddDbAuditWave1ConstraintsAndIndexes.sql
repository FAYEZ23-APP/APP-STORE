START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN

    UPDATE "VendorWallets" SET "Balance" = 0 WHERE "Balance" < 0;
    UPDATE "VendorWallets" SET "PendingBalance" = 0 WHERE "PendingBalance" < 0;
    UPDATE "BuyerWallets" SET "Balance" = 0 WHERE "Balance" < 0;
    UPDATE "Products" SET "Stock" = 0 WHERE "Stock" < 0;
    UPDATE "Products" SET "Price" = 0 WHERE "Price" < 0;
    UPDATE "ProductVariants" SET "Stock" = 0 WHERE "Stock" < 0;
    UPDATE "OrderItems" SET "Quantity" = 1 WHERE "Quantity" <= 0;
    UPDATE "OrderItems" SET "UnitPrice" = 0 WHERE "UnitPrice" < 0;
    UPDATE "PayoutRequests" SET "Amount" = 1 WHERE "Amount" <= 0;

    -- Deduplicate default user addresses before adding partial unique index
    WITH ranked AS (
      SELECT "Id", "UserId", ROW_NUMBER() OVER(PARTITION BY "UserId" ORDER BY "CreatedAt" DESC, "Id" DESC) as rn
      FROM "UserAddresses"
      WHERE "IsDefault" = TRUE
    )
    UPDATE "UserAddresses"
    SET "IsDefault" = FALSE
    WHERE "Id" IN (SELECT "Id" FROM ranked WHERE rn > 1);

    -- Fix migration drift #17 (DB-005): unify migration history ID and align FK to RESTRICT
    DO $$
    BEGIN
        UPDATE "__EFMigrationsHistory" 
        SET "MigrationId" = '20261028024709_AddAdminAuditLogsAndCategoryBilingualNames' 
        WHERE "MigrationId" = '20261028015637_AddAdminAuditLogsAndCategoryBilingualNames';

        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
              AND conrelid = '"AdminAuditLogs"'::regclass 
              AND confdeltype != 'r'
        ) THEN
            ALTER TABLE "AdminAuditLogs" DROP CONSTRAINT "FK_AdminAuditLogs_Users_AdminId";
            ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "FK_AdminAuditLogs_Users_AdminId" 
                FOREIGN KEY ("AdminId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
        END IF;
    END $$;

    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    DROP INDEX "IX_UserAddresses_UserId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    DROP INDEX "IX_Products_SearchVector";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "VendorWallets" ADD CONSTRAINT "CK_VendorWallets_Balances_NonNegative" CHECK ("Balance" >= 0 AND "PendingBalance" >= 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    CREATE UNIQUE INDEX "IX_UserAddresses_UserId_SingleDefault" ON "UserAddresses" ("UserId") WHERE "IsDefault" = TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "ProductVariants" ADD CONSTRAINT "CK_ProductVariants_Stock_And_Price_NonNegative" CHECK ("Stock" >= 0 AND ("PriceOverride" IS NULL OR "PriceOverride" >= 0));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    CREATE INDEX "IX_Products_SearchVector_GinTrgm" ON "Products" USING gin ("SearchVector" gin_trgm_ops);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "Products" ADD CONSTRAINT "CK_Products_Stock_And_Price_NonNegative" CHECK ("Stock" >= 0 AND "Price" >= 0 AND ("OldPrice" IS NULL OR "OldPrice" >= 0));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "PayoutRequests" ADD CONSTRAINT "CK_PayoutRequests_Amount_Positive" CHECK ("Amount" > 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    CREATE INDEX "IX_Orders_BuyerId_CreatedAt" ON "Orders" ("BuyerId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "OrderItems" ADD CONSTRAINT "CK_OrderItems_Quantity_And_Price_Valid" CHECK ("Quantity" > 0 AND "UnitPrice" >= 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    ALTER TABLE "BuyerWallets" ADD CONSTRAINT "CK_BuyerWallets_Balance_NonNegative" CHECK ("Balance" >= 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN

    CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email_Lower" ON "Users" (lower("Email")) WHERE "Email" IS NOT NULL AND "Email" <> '';

    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261102013200_AddDbAuditWave1ConstraintsAndIndexes', '10.0.5');
    END IF;
END $EF$;
COMMIT;

