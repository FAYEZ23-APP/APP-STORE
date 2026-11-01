START TRANSACTION;
ALTER TABLE "Users" ADD "IsTwoFactorEnabled" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE "Users" ADD "TwoFactorSecret" character varying(128);

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261030044204_AddAdminTwoFactorAuth', '10.0.5');

COMMIT;

