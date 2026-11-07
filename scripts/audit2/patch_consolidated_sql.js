const fs = require('fs');
const file = 'scripts/audit2/consolidated-remediation.sql';
let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldSnippet = `    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
          AND conrelid = '"AdminAuditLogs"'::regclass 
          AND confdeltype != 'r'
    ) THEN
        ALTER TABLE "AdminAuditLogs" DROP CONSTRAINT "FK_AdminAuditLogs_Users_AdminId";
        ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "FK_AdminAuditLogs_Users_AdminId" 
            FOREIGN KEY ("AdminId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
    END IF;`;

const newSnippet = `    IF to_regclass('"AdminAuditLogs"') IS NOT NULL THEN
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

if (text.includes(oldSnippet)) {
    text = text.replace(oldSnippet, newSnippet);
    fs.writeFileSync(file, text, 'utf8');
    console.log('Successfully patched consolidated-remediation.sql');
} else {
    console.error('Target not found in consolidated-remediation.sql');
}
