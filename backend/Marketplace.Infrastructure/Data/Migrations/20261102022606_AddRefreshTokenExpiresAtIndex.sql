START TRANSACTION;
CREATE INDEX "IX_RefreshTokens_ExpiresAt" ON "RefreshTokens" ("ExpiresAt");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261102022606_AddRefreshTokenExpiresAtIndex', '10.0.5');

COMMIT;

