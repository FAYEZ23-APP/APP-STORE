START TRANSACTION;
ALTER TABLE "Shipments" ADD "CodSettledAt" timestamp with time zone;

ALTER TABLE "Shipments" ADD "IsCodSettled" boolean NOT NULL DEFAULT FALSE;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261030054444_AddCodEscrowHoldToShipments', '10.0.5');

COMMIT;

