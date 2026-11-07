START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    ALTER TABLE "RefreshTokens" ADD "ConsumedAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    ALTER TABLE "RefreshTokens" ADD "FamilyId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    ALTER TABLE "RefreshTokens" ADD "RevokeReason" character varying(40);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN

                    UPDATE "RefreshTokens" r
                    SET "FamilyId" = g.fid
                    FROM (
                        SELECT d."UserId", d."DeviceId", gen_random_uuid() AS fid
                        FROM (SELECT DISTINCT "UserId", "DeviceId" FROM "RefreshTokens") d
                    ) g
                    WHERE r."UserId" = g."UserId" AND r."DeviceId" = g."DeviceId";

                    UPDATE "RefreshTokens"
                    SET "ConsumedAt" = "RevokedAt", "RevokeReason" = COALESCE("RevokeReason", 'Rotated')
                    WHERE "ReplacedByTokenId" IS NOT NULL AND "RevokedAt" IS NOT NULL AND "ConsumedAt" IS NULL;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    CREATE INDEX "IX_RefreshTokens_FamilyId" ON "RefreshTokens" ("FamilyId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    CREATE INDEX "IX_RefreshTokens_RevokedAt" ON "RefreshTokens" ("RevokedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261106010834_Phase4RefreshTokenFamilies') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261106010834_Phase4RefreshTokenFamilies', '10.0.5');
    END IF;
END $EF$;
COMMIT;

