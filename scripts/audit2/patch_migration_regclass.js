const fs = require('fs');

// Patch 1: .cs migration file
const csFile = 'backend/Marketplace.Infrastructure/Data/Migrations/20261102013200_AddDbAuditWave1ConstraintsAndIndexes.cs';
let csText = fs.readFileSync(csFile, 'utf8').replace(/\r\n/g, '\n');

const csOld = `    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
          AND conrelid = '""AdminAuditLogs""'::regclass 
          AND confdeltype != 'r'
    ) THEN
        ALTER TABLE ""AdminAuditLogs"" DROP CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"";
        ALTER TABLE ""AdminAuditLogs"" ADD CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"" 
            FOREIGN KEY (""AdminId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT;
    END IF;`;

const csNew = `    IF to_regclass('""AdminAuditLogs""') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
              AND conrelid = to_regclass('""AdminAuditLogs""') 
              AND confdeltype != 'r'
        ) THEN
            ALTER TABLE ""AdminAuditLogs"" DROP CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"";
            ALTER TABLE ""AdminAuditLogs"" ADD CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"" 
                FOREIGN KEY (""AdminId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT;
        END IF;
    END IF;`;

if (csText.includes(csOld)) {
    csText = csText.replace(csOld, csNew);
    fs.writeFileSync(csFile, csText, 'utf8');
    console.log('CS migration file successfully patched.');
} else {
    console.error('CS old snippet not found!');
}

// Patch 2: .sql migration file
const sqlFile = 'backend/Marketplace.Infrastructure/Data/Migrations/20261102013200_AddDbAuditWave1ConstraintsAndIndexes.sql';
let sqlText = fs.readFileSync(sqlFile, 'utf8').replace(/\r\n/g, '\n');

const sqlOld = `        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
              AND conrelid = '"AdminAuditLogs"'::regclass 
              AND confdeltype != 'r'
        ) THEN
            ALTER TABLE "AdminAuditLogs" DROP CONSTRAINT "FK_AdminAuditLogs_Users_AdminId";
            ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "FK_AdminAuditLogs_Users_AdminId" 
                FOREIGN KEY ("AdminId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
        END IF;`;

const sqlNew = `        IF to_regclass('"AdminAuditLogs"') IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
                  AND conrelid = to_regclass('"AdminAuditLogs"') 
                  AND confdeltype != 'r'
            ) THEN
                ALTER TABLE "AdminAuditLogs" DROP CONSTRAINT "FK_AdminAuditLogs_Users_AdminId";
                ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "FK_AdminAuditLogs_Users_AdminId" 
                    FOREIGN KEY ("AdminId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
            END IF;
        END IF;`;

if (sqlText.includes(sqlOld)) {
    sqlText = sqlText.replace(sqlOld, sqlNew);
    fs.writeFileSync(sqlFile, sqlText, 'utf8');
    console.log('SQL migration file successfully patched.');
} else {
    console.error('SQL old snippet not found!');
}
