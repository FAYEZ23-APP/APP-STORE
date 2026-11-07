-- =====================================================================
-- Wave 7: Bosta Provider, PUDO Points, Courier Tracking, WhatsApp/NTRA
-- =====================================================================

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107061739_AddWave7BostaPudoCourierTracking') THEN
    ALTER TABLE "Shipments" ADD "CourierName" character varying(150);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107061739_AddWave7BostaPudoCourierTracking') THEN
    ALTER TABLE "Shipments" ADD "CourierPhone" character varying(30);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107061739_AddWave7BostaPudoCourierTracking') THEN
    ALTER TABLE "Shipments" ADD "EstimatedDeliveryAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107061739_AddWave7BostaPudoCourierTracking') THEN
    ALTER TABLE "Shipments" ADD "PickupPointCode" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107061739_AddWave7BostaPudoCourierTracking') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261107061739_AddWave7BostaPudoCourierTracking', '10.0.5');
    END IF;
END $EF$;
