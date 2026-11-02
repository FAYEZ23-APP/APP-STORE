SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = '"AdminAuditLogs"'::regclass AND contype = 'f';
SELECT "MigrationId" FROM "__EFMigrationsHistory" WHERE "MigrationId" LIKE '%AdminAuditLogs%' OR "MigrationId" LIKE '%20261028%';
