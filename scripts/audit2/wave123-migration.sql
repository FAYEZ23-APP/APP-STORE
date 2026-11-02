START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261101231814_AddWalletAndPayoutConcurrencyTokens') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261101231814_AddWalletAndPayoutConcurrencyTokens', '10.0.5');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Users" ADD "CodRefusalCount" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "AllowInspection" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "Apartment" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "BuildingNumber" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "DeliveryLatitude" double precision;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "DeliveryLongitude" double precision;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "EscrowReleaseAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "Floor" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Shipments" ADD "Landmark" character varying(250);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "ReturnRequests" ALTER COLUMN "Status" TYPE character varying(30);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "ReturnRequests" ADD "Category" character varying(50) NOT NULL DEFAULT 'Standard14Day';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "ReturnRequests" ADD "ReceivedAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Products" ADD "AllowInspection" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "Apartment" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "BuildingNumber" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "ConfirmedAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "DeliveryLatitude" double precision;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "DeliveryLongitude" double precision;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "Floor" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "IsBuyerConfirmed" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    ALTER TABLE "Orders" ADD "Landmark" character varying(250);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261102000426_AddGapsRemediationWave123', '10.0.5');
    END IF;
END $EF$;
COMMIT;

