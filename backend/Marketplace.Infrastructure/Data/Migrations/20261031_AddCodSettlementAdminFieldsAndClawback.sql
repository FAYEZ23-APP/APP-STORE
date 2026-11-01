START TRANSACTION;
ALTER TABLE "Shipments" ADD "FlaggedForReview" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE "Shipments" ADD "ReceivedAmount" numeric(18,2);

ALTER TABLE "Shipments" ADD "SettledByAdminId" integer;

ALTER TABLE "Shipments" ADD "SettlementReference" character varying(100);

CREATE INDEX "IX_Shipments_SettledByAdminId" ON "Shipments" ("SettledByAdminId");

ALTER TABLE "Shipments" ADD CONSTRAINT "FK_Shipments_Users_SettledByAdminId" FOREIGN KEY ("SettledByAdminId") REFERENCES "Users" ("Id") ON DELETE SET NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261031010308_AddCodSettlementAdminFieldsAndClawback', '10.0.5');

COMMIT;

