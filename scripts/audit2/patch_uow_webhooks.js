const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs');
let c = fs.readFileSync(p, 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

const target1 = `        AdminAuditLogs = new Repository<AdminAuditLog>(context);
        CodBlacklistEntries = new Repository<CodBlacklistEntry>(context);
    }`;

const repl1 = `        AdminAuditLogs = new Repository<AdminAuditLog>(context);
        CodBlacklistEntries = new Repository<CodBlacklistEntry>(context);
        ProcessedWebhookEvents = new Repository<ProcessedWebhookEvent>(context);
    }`;

const target2 = `    public IRepository<AdminAuditLog> AdminAuditLogs { get; }
    public IRepository<CodBlacklistEntry> CodBlacklistEntries { get; }`;

const repl2 = `    public IRepository<AdminAuditLog> AdminAuditLogs { get; }
    public IRepository<CodBlacklistEntry> CodBlacklistEntries { get; }
    public IRepository<ProcessedWebhookEvent> ProcessedWebhookEvents { get; }`;

if (!c.includes(target1) || !c.includes(target2)) {
    throw new Error('Targets not found in UnitOfWork.cs');
}

c = c.replace(target1, repl1).replace(target2, repl2);
if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync(p, c, 'utf8');
console.log('UnitOfWork.cs patched with ProcessedWebhookEvents!');
